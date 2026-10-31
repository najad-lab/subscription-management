from django.contrib import admin
from .models import Product, Plan, Subscription, Invoice, Payment
admin.site.register(Product)
admin.site.register(Plan)
admin.site.register(Subscription)
admin.site.register(Invoice)
admin.site.register(Payment)
