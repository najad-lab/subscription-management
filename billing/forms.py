from django import forms
from .models import Product, Plan, Subscription, Invoice, Payment

class StyledModelForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"

class ProductForm(StyledModelForm):
    class Meta:
        model = Product
        fields = ["name","product_type","sales_price","cost_price","notes"]

class PlanForm(StyledModelForm):
    class Meta:
        model = Plan
        fields = ["name","product","price","billing_cycle","minimum_quantity","available_from","available_until","auto_close","active"]
        widgets = {"available_from": forms.DateInput(attrs={"type":"date"}), "available_until": forms.DateInput(attrs={"type":"date"})}

class SubscriptionForm(StyledModelForm):
    class Meta:
        model = Subscription
        fields = ["customer_name","customer_email","plan","quantity","start_date","expiry_date","status","payment_terms"]
        widgets = {"start_date": forms.DateInput(attrs={"type":"date"}), "expiry_date": forms.DateInput(attrs={"type":"date"})}

class InvoiceForm(StyledModelForm):
    class Meta:
        model = Invoice
        fields = ["subscription","due_date","tax_percent","discount_percent","status"]
        widgets = {"due_date": forms.DateInput(attrs={"type":"date"})}

class PaymentForm(StyledModelForm):
    class Meta:
        model = Payment
        fields = ["invoice","amount","method","payment_date","note"]
        widgets = {"payment_date": forms.DateInput(attrs={"type":"date"})}
