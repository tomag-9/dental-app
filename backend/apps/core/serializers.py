from rest_framework import serializers

from .models import AuditLog, Lab, Notification, TeamInvitation, User


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
            "notification_preferences",
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


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = (
            "id",
            "lab",
            "recipient",
            "type",
            "title",
            "message",
            "url",
            "is_read",
            "read_at",
            "created_at",
        )
        read_only_fields = ("is_read", "read_at", "created_at")


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    lab_name = serializers.CharField(source="lab.name", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_username",
            "lab",
            "lab_name",
            "action",
            "entity_type",
            "entity_id",
            "description",
            "metadata",
            "ip_address",
            "created_at",
        )
        read_only_fields = fields


class TeamInvitationSerializer(serializers.ModelSerializer):
    lab_name = serializers.CharField(source="lab.name", read_only=True)
    invited_by_username = serializers.SerializerMethodField()
    accepted_by_username = serializers.SerializerMethodField()
    token = serializers.CharField(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = TeamInvitation
        fields = (
            "id",
            "lab",
            "lab_name",
            "email",
            "role",
            "token",
            "status",
            "is_expired",
            "invited_by",
            "invited_by_username",
            "accepted_by",
            "accepted_by_username",
            "expires_at",
            "accepted_at",
            "created_at",
        )
        read_only_fields = (
            "token",
            "status",
            "is_expired",
            "invited_by",
            "accepted_by",
            "expires_at",
            "accepted_at",
            "created_at",
        )

    def get_invited_by_username(self, obj):
        return obj.invited_by.username if obj.invited_by else None

    def get_accepted_by_username(self, obj):
        return obj.accepted_by.username if obj.accepted_by else None

    def validate_role(self, value):
        if value == "superadmin":
            raise serializers.ValidationError("Cannot invite superadmin users.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        lab = attrs.get("lab") or getattr(user, "lab", None)
        email = attrs.get("email")
        if lab and email:
            pending = TeamInvitation.objects.filter(
                lab=lab,
                email__iexact=email,
                status="pending",
            )
            if self.instance:
                pending = pending.exclude(pk=self.instance.pk)
            if pending.exists():
                raise serializers.ValidationError(
                    {"email": "Pending invitation already exists for this email."}
                )
        return attrs


class TeamInvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)


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
    notification_preferences = serializers.JSONField(required=False)


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)


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
