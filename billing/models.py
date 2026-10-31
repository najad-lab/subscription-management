from django.db import models
from django.utils import timezone
from decimal import Decimal

class Product(models.Model):
    PRODUCT_TYPES = [("software", "Software"), ("addon", "Add-on"), ("variant", "Variant")]
    name = models.CharField(max_length=120)
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default="software")
    sales_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return self.name

class Plan(models.Model):
    CYCLES = [("daily","Daily"),("weekly","Weekly"),("monthly","Monthly"),("yearly","Yearly")]
    name = models.CharField(max_length=120)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="plans")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    billing_cycle = models.CharField(max_length=10, choices=CYCLES, default="monthly")
    minimum_quantity = models.PositiveIntegerField(default=1)
    available_from = models.DateField(default=timezone.localdate)
    available_until = models.DateField(null=True, blank=True)
    auto_close = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    def __str__(self): return f"{self.name} ({self.billing_cycle})"

class Subscription(models.Model):
    STATUSES = [("Draft","Draft"),("Quotation","Quotation"),("Confirmed","Confirmed"),("Active","Active"),("Paused","Paused"),("Closed","Closed")]
    customer_name = models.CharField(max_length=120)
    customer_email = models.EmailField()
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    start_date = models.DateField(default=timezone.localdate)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUSES, default="Draft")
    payment_terms = models.CharField(max_length=100, default="Due on receipt")
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self): return f"SUB-{self.pk or 'new'}: {self.customer_name}"
    @property
    def total(self): return self.plan.price * self.quantity

class Invoice(models.Model):
    STATUSES = [("Draft","Draft"),("Confirmed","Confirmed"),("Paid","Paid"),("Cancelled","Cancelled")]
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name="invoices")
    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(default=timezone.localdate)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUSES, default="Draft")
    def save(self, *args, **kwargs):
        self.subtotal = self.subscription.total
        discount = self.subtotal * self.discount_percent / Decimal("100")
        taxable = self.subtotal - discount
        tax = taxable * self.tax_percent / Decimal("100")
        self.total = taxable + tax
        super().save(*args, **kwargs)
        if not self.invoice_number:
            self.invoice_number = f"INV-{self.pk:05d}"
            super().save(update_fields=["invoice_number"])
    def __str__(self): return self.invoice_number or f"Invoice {self.pk}"

class Payment(models.Model):
    METHODS = [("Cash","Cash"),("Bank Transfer","Bank Transfer"),("UPI","UPI"),("Card","Card"),("Other","Other")]
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=30, choices=METHODS, default="UPI")
    payment_date = models.DateField(default=timezone.localdate)
    note = models.CharField(max_length=250, blank=True)
    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        paid = sum((p.amount for p in self.invoice.payments.all()), Decimal("0"))
        if paid >= self.invoice.total:
            self.invoice.status = "Paid"
            self.invoice.save()
