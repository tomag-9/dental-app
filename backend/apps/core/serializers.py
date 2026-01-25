from rest_framework import serializers
from .models import Lab, User

class LabSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lab
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    lab_details = LabSerializer(source='lab', read_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'nickname', 'role', 'lab', 'lab_details', 'first_name', 'last_name', 'is_active', 'date_joined')
        read_only_fields = ('date_joined',)
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user
