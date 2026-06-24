from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from .models import Bill, PatientBasicProfile, PartialCollectRequest, Queue, ServiceRate, User
from .services import GoogleSheetsService


class ServiceRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceRate
        fields = [
            "id", "name", "category", "default_rate", "unit",
            "is_active", "description", "created_at", "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")


class BillLineItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    rate_per_day = serializers.DecimalField(max_digits=12, decimal_places=2)
    days = serializers.IntegerField(min_value=0)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)


class PartialCollectRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PartialCollectRequest
        fields = ["id", "collect_amount", "collect_label", "created_at"]
        read_only_fields = ("created_at",)


class BillSerializer(serializers.ModelSerializer):
    line_items = BillLineItemSerializer(many=True)
    partial_collect_requests = PartialCollectRequestSerializer(many=True, read_only=True)

    class Meta:
        model = Bill
        fields = [
            "id", "bill_type",
            # IPD
            "ipd_no", "admitted_on", "discharged_on", "room_no", "ward", "total_stay",
            # OPD
            "opd_no", "visit_date",
            # Shared patient info
            "patient_name", "address", "mobile_no", "gender", "weight", "height", "age", "pulse_rate",
            "line_items",
            "total_bill", "advance_paid", "advance_paid_via", "discount", "discount_note", "net_bill",
            "partially_collected", "total_partially_collected",
            "payment_status", "paid_via", "partial_amount", "partial_amount_via",
            "callout", "remote_row_ref", "created_at",
            "partial_collect_requests",
        ]
        read_only_fields = (
            "ipd_no", "opd_no",                                # auto-assigned
            "total_bill", "net_bill",                          # computed
            "partially_collected", "total_partially_collected", # managed by execute-collect API
            "callout",                                          # auto-managed by API
            "remote_row_ref", "created_at",
        )

    def validate(self, attrs):
        is_create = self.instance is None
        bill_type = attrs.get(
            "bill_type",
            self.instance.bill_type if self.instance else "IPD",
        )

        # Required-field checks only on CREATE
        if is_create:
            if bill_type == "IPD" and not attrs.get("admitted_on"):
                raise serializers.ValidationError(
                    {"admitted_on": "Admitted date is required for IPD bills."}
                )
            if bill_type == "OPD" and not attrs.get("visit_date"):
                raise serializers.ValidationError(
                    {"visit_date": "Visit date is required for OPD bills."}
                )

        # Always validate date ordering when both dates are present
        if bill_type == "IPD":
            admitted_on = attrs.get("admitted_on") or (self.instance.admitted_on if self.instance else None)
            discharged_on = attrs.get("discharged_on") or (self.instance.discharged_on if self.instance else None)
            if discharged_on and admitted_on and discharged_on < admitted_on:
                raise serializers.ValidationError(
                    "Discharged date cannot be before admitted date."
                )

        return attrs

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _compute_line_items(line_items):
        normalized = []
        total_bill = Decimal("0.00")
        for item in line_items:
            rate = Decimal(item["rate_per_day"])
            days = int(item["days"])
            amount = (rate * Decimal(days)).quantize(Decimal("0.01"))
            normalized.append({
                "name": item["name"],
                "rate_per_day": str(rate),
                "days": days,
                "amount": str(amount),
            })
            # Only positive amounts count toward total_bill;
            # negative items are audit entries for partial collections.
            if amount > Decimal("0.00"):
                total_bill += amount
        return normalized, total_bill

    @staticmethod
    def _compute_net(total_bill, advance, discount, total_partially_collected=Decimal("0.00")):
        disc = Decimal(discount) if discount is not None else Decimal("0.00")
        pc   = Decimal(str(total_partially_collected)) if total_partially_collected else Decimal("0.00")
        return (Decimal(total_bill) - Decimal(advance) - disc - pc).quantize(Decimal("0.01"))

    @staticmethod
    def _next_bill_no(bill_type: str) -> str:
        """Atomically get the next sequential number for a bill type."""
        field = "ipd_no" if bill_type == "IPD" else "opd_no"
        rows = (
            Bill.objects
            .filter(bill_type=bill_type)
            .exclude(**{f"{field}__isnull": True})
            .select_for_update()
            .values_list(field, flat=True)
        )
        max_val = 0
        for val in rows:
            try:
                max_val = max(max_val, int(val))
            except (ValueError, TypeError):
                pass
        return str(max_val + 1)

    # ── Write operations ──────────────────────────────────────────────────────

    def create(self, validated_data):
        line_items = validated_data.pop("line_items", [])
        normalized_items, total_bill = self._compute_line_items(line_items)
        advance = Decimal(validated_data.get("advance_paid", Decimal("0.00")))
        discount = validated_data.get("discount")
        net_bill = self._compute_net(total_bill, advance, discount)

        bill_type = validated_data.get("bill_type", "IPD")

        with transaction.atomic():
            # Auto-assign sequential bill number
            bill_no = self._next_bill_no(bill_type)
            if bill_type == "IPD":
                validated_data["ipd_no"] = bill_no
            else:
                validated_data["opd_no"] = bill_no

            bill = Bill.objects.create(
                **validated_data,
                line_items=normalized_items,
                total_bill=total_bill,
                net_bill=net_bill,
            )

            # Append to the correct Google Sheet
            try:
                svc = GoogleSheetsService(bill_type=bill_type)
                row_ref = svc.append_bill_row(bill)
            except Exception as exc:  # noqa: BLE001
                raise serializers.ValidationError({"google_sheets": str(exc)}) from exc

            bill.remote_row_ref = row_ref
            bill.save(update_fields=["remote_row_ref"])

        return bill

    def update(self, instance, validated_data):
        # Prevent bill_type from being changed after creation
        validated_data.pop("bill_type", None)
        # partially_collected and total_partially_collected are managed by the
        # execute-collect API — never writable via the standard edit endpoint.
        validated_data.pop("partially_collected", None)
        validated_data.pop("total_partially_collected", None)

        # Immutable partial collection total from DB (used in net_bill computation)
        pc_total = instance.total_partially_collected

        line_items = validated_data.pop("line_items", None)

        if line_items is not None:
            normalized_items, total_bill = self._compute_line_items(line_items)
            advance  = Decimal(validated_data.get("advance_paid", instance.advance_paid))
            discount = validated_data.get("discount", instance.discount)
            net_bill = self._compute_net(total_bill, advance, discount, pc_total)
            validated_data["line_items"] = normalized_items
            validated_data["total_bill"] = total_bill
            validated_data["net_bill"]   = net_bill
        elif "advance_paid" in validated_data or "discount" in validated_data:
            advance  = Decimal(validated_data.get("advance_paid", instance.advance_paid))
            discount = validated_data.get("discount", instance.discount)
            validated_data["net_bill"] = self._compute_net(
                instance.total_bill, advance, discount, pc_total
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class BillPaymentSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for the dedicated payment endpoint.
    Only `payment_status` and `paid_via` are writable; everything else is
    returned read-only so the frontend can update its local state in one call.
    """

    class Meta:
        model = Bill
        fields = ["id", "payment_status", "paid_via", "partial_amount", "partial_amount_via"]


class PatientBasicProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientBasicProfile
        fields = [
            "id",
            "patient_name", "address", "mobile_no", "gender",
            "age", "weight", "height", "pulse_rate",
            "has_diabetes", "has_high_bp", "has_heart_disease",
            "has_asthma", "has_recent_surgery", "is_pregnant",
            "has_thyroid", "has_kidney_disease",
            "condition_notes",
            "created_at", "updated_at",
        ]
        read_only_fields = ("created_at", "updated_at")


class QueueSerializer(serializers.ModelSerializer):
    patient = PatientBasicProfileSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=PatientBasicProfile.objects.all(),
        source="patient",
        write_only=True,
        required=False,
    )

    class Meta:
        model = Queue
        fields = [
            "id", "patient", "patient_id",
            "queue_number", "status", "date",
            "reception_bill_type",
            "reception_line_items",
            "reception_amount_collected",
            "reception_paid_via",
            "created_at", "updated_at",
        ]
        read_only_fields = ("queue_number", "date", "created_at", "updated_at")


class UserSerializer(serializers.ModelSerializer):
    """Serializer for listing users (no password field)."""
    
    class Meta:
        model = User
        fields = ["id", "username", "role", "is_active", "plain_password", "created_at", "updated_at"]
        read_only_fields = ("created_at", "updated_at")


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new user with password."""
    password = serializers.CharField(write_only=True, min_length=4)
    
    class Meta:
        model = User
        fields = ["id", "username", "password", "role", "is_active"]
    
    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user info, optionally with password. Role cannot be changed after creation."""
    password = serializers.CharField(write_only=True, min_length=4, required=False, allow_blank=True)
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ["username", "is_active", "password", "current_password"]
        # Note: role is excluded - cannot be changed after user creation
    
    def validate_username(self, value):
        # Check if username is being changed and if it's unique
        if self.instance and value != self.instance.username:
            # Check if user is trying to change their own username
            request = self.context.get("request")
            if request and self.instance.username == request.user.username:
                raise serializers.ValidationError("You cannot change your own username.")
            
            # Check if new username already exists
            if User.objects.filter(username=value).exists():
                raise serializers.ValidationError("A user with that username already exists.")
        return value
    
    def validate(self, data):
        """Validate that current password is provided when user changes their own password."""
        request = self.context.get("request")
        password = data.get("password")
        current_password = data.get("current_password")
        is_active = data.get("is_active")
        
        # Check if editing self
        is_self = self.instance and request and self.instance.username == request.user.username
        
        if is_self:
            # Prevent users from deactivating themselves
            if is_active is not None and not is_active:
                raise serializers.ValidationError({
                    "is_active": "You cannot deactivate your own account."
                })
        
        # If user is changing their own password, current password is required
        if password and self.instance and request:
            is_self = self.instance.username == request.user.username
            if is_self:
                if not current_password:
                    raise serializers.ValidationError({
                        "current_password": "Current password is required when changing your own password."
                    })
                # Verify current password is correct
                if not self.instance.check_password(current_password):
                    raise serializers.ValidationError({
                        "current_password": "Current password is incorrect."
                    })
        
        return data
    
    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("current_password", None)  # Remove current_password, it was only for validation
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        # Update password if provided
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing user password."""
    user_id = serializers.IntegerField(required=False)
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=4)
    
    def validate(self, data):
        request = self.context.get("request")
        user_id = data.get("user_id")
        
        # If user_id is provided, doctor is changing another user's password
        if user_id:
            if request.user.role != "doctor":
                raise serializers.ValidationError("Only doctors can change other users' passwords.")
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                raise serializers.ValidationError("User not found.")
            
            # Prevent doctors from changing other doctors' passwords
            if target_user.role == "doctor" and target_user.username != request.user.username:
                raise serializers.ValidationError("You cannot change another doctor's password.")
        else:
            # Changing own password
            target_user = User.objects.get(username=request.user.username)
        
        # Verify current password
        if not target_user.check_password(data["current_password"]):
            raise serializers.ValidationError("Current password is incorrect.")
        
        data["target_user"] = target_user
        return data
    
    def save(self):
        target_user = self.validated_data["target_user"]
        target_user.set_password(self.validated_data["new_password"])
        target_user.save()
        return target_user
