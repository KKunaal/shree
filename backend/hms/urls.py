from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("billing.urls")),
    path("api/profile/", include("patient_profile.urls")),
]
