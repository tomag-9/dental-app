from rest_framework import serializers

from .models import Lab, User


class LabSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lab
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    lab_details = LabSerializer(source="lab", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "nickname",
            "password",
            "role",
            "lab",
            "lab_details",
            "first_name",
            "last_name",
            "is_active",
            "date_joined",
        )
        read_only_fields = ("date_joined",)
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


class MeUpdateSerializer(serializers.Serializer):
    nickname = serializers.CharField(
        max_length=150, required=False, allow_blank=True, allow_null=True
    )
    email = serializers.EmailField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    role = serializers.ChoiceField(
        choices=User.ROLE_CHOICES,
        required=False,
    )
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)


class SignupRequestSerializer(serializers.Serializer):
    lab_name = serializers.CharField(max_length=255)
    lab_address = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    lab_city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    lab_email = serializers.EmailField(required=False, allow_null=True)

    nickname = serializers.CharField(
        max_length=150, required=False, allow_blank=True, allow_null=True
    )
    email = serializers.EmailField(required=False, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=6)


class SignupResponseSerializer(serializers.Serializer):
    lab = LabSerializer()
    user = UserSerializer()
    token = serializers.DictField()
