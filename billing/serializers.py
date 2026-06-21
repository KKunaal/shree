from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import Bill, ServiceRate
from .services import GoogleSheetsService


class ServiceRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRate
        fields = [
            "id",
            "name",
            "category",
            "default_rate",
            "unit",
            "is_active",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")


class BillLineItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    rate_per_day = serializers.DecimalField(max_digits=12, decimal_places=2)
    days = serializers.IntegerField(min_value=0)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)


class BillSerializer(serializers.ModelSerializer):
    line_items = BillLineItemSerializer(many=True)

    class Meta:
        model = Bill
        fields = [
            "id",
            "patient_name",
            "address",
            "ipd_no",
            "admitted_on",
            "discharged_on",
            "room_no",
            "ward",
            "total_stay",
            "line_items",
            "total_bill",
            "advance_paid",
            "net_bill",
            "remote_row_ref",
            "created_at",
        ]
        read_only_fields = ("total_bill", "net_bill", "remote_row_ref", "created_at")

    def validate(self, attrs):
        admitted_on = attrs.get("admitted_on")
        discharged_on = attrs.get("discharged_on")

        if discharged_on and admitted_on and discharged_on < admitted_on:
            raise serializers.ValidationError("Discharged date cannot be before admitted date.")

        return attrs

    @staticmethod
    def _compute_line_items(line_items):
        normalized = []
        total_bill = Decimal("0.00")

        for item in line_items:
            rate = Decimal(item["rate_per_day"])
            days = int(item["days"])
            amount = (rate * Decimal(days)).quantize(Decimal("0.01"))

            normalized.append(
                {
                    "name": item["name"],
                    "rate_per_day": str(rate),
                    "days": days,
                    "amount": str(amount),
                }
            )
            total_bill += amount

        return normalized, total_bill

    def create(self, validated_data):
        line_items = validated_data.pop("line_items", [])
        normalized_items, total_bill = self._compute_line_items(line_items)
        advance = Decimal(validated_data.get("advance_paid", Decimal("0.00")))
        net_bill = (total_bill - advance).quantize(Decimal("0.01"))

        with transaction.atomic():
            bill = Bill.objects.create(
                **validated_data,
                line_items=normalized_items,
                total_bill=total_bill,
                net_bill=net_bill,
            )

            try:
                row_ref = GoogleSheetsService().append_bill_row(bill)
            except Exception as exc:  # noqa: BLE001
                raise serializers.ValidationError({"google_sheets": str(exc)}) from exc

            bill.remote_row_ref = row_ref
            bill.save(update_fields=["remote_row_ref"])

        return bill

    def update(self, instance, validated_data):
        line_items = validated_data.pop("line_items", None)

        # Recompute totals only when line_items are supplied in the request
        if line_items is not None:
            normalized_items, total_bill = self._compute_line_items(line_items)
            advance = Decimal(
                validated_data.get("advance_paid", instance.advance_paid)
            )
            net_bill = (total_bill - advance).quantize(Decimal("0.01"))
            validated_data["line_items"] = normalized_items
            validated_data["total_bill"] = total_bill
            validated_data["net_bill"] = net_bill
        else:
            # If only patient/meta fields change, recompute net from existing total
            if "advance_paid" in validated_data:
                advance = Decimal(validated_data["advance_paid"])
                validated_data["net_bill"] = (
                    instance.total_bill - advance
                ).quantize(Decimal("0.01"))

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
