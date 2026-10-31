from decimal import Decimal
from django.contrib import messages
from django.db.models import Sum, Count
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from .models import Product, Plan, Subscription, Invoice, Payment
from .forms import ProductForm, PlanForm, SubscriptionForm, InvoiceForm, PaymentForm

def dashboard(request):
    today = timezone.localdate()
    invoices = Invoice.objects.exclude(status__in=["Paid","Cancelled"])
    context = {
        "active_count": Subscription.objects.filter(status="Active").count(),
        "revenue": Payment.objects.aggregate(v=Sum("amount"))["v"] or Decimal("0"),
        "outstanding": invoices.aggregate(v=Sum("total"))["v"] or Decimal("0"),
        "overdue": invoices.filter(due_date__lt=today).count(),
        "subscriptions": Subscription.objects.select_related("plan","plan__product").order_by("-created_at")[:6],
        "invoices": Invoice.objects.select_related("subscription").order_by("-issue_date")[:6],
    }
    return render(request,"billing/dashboard.html",context)

def products(request):
    items=Product.objects.all().order_by("-created_at")
    return render(request,"billing/products.html",{"items":items})

def product_add(request):
    form=ProductForm(request.POST or None)
    if form.is_valid():
        form.save(); messages.success(request,"Product created."); return redirect("products")
    return render(request,"billing/form.html",{"form":form,"title":"Add product"})

def plans(request):
    return render(request,"billing/plans.html",{"items":Plan.objects.select_related("product").all()})

def plan_add(request):
    form=PlanForm(request.POST or None)
    if form.is_valid():
        form.save(); messages.success(request,"Plan created."); return redirect("plans")
    return render(request,"billing/form.html",{"form":form,"title":"Add plan"})

def subscriptions(request):
    return render(request,"billing/subscriptions.html",{"items":Subscription.objects.select_related("plan","plan__product").order_by("-created_at")})

def subscription_add(request):
    form=SubscriptionForm(request.POST or None)
    if form.is_valid():
        obj=form.save()
        messages.success(request,f"Subscription SUB-{obj.pk:05d} created.")
        return redirect("subscriptions")
    return render(request,"billing/form.html",{"form":form,"title":"Create subscription"})

def subscription_status(request, pk, status):
    obj=get_object_or_404(Subscription,pk=pk)
    allowed=dict(Subscription.STATUSES)
    if status in allowed:
        obj.status=status; obj.save()
        messages.success(request,f"Subscription status changed to {status}.")
    return redirect("subscriptions")

def invoices(request):
    return render(request,"billing/invoices.html",{"items":Invoice.objects.select_related("subscription").order_by("-issue_date")})

def invoice_add(request):
    form=InvoiceForm(request.POST or None)
    if form.is_valid():
        form.save(); messages.success(request,"Invoice created."); return redirect("invoices")
    return render(request,"billing/form.html",{"form":form,"title":"Create invoice"})

def generate_invoice(request, pk):
    sub=get_object_or_404(Subscription,pk=pk)
    if sub.status not in ["Active","Confirmed"]:
        messages.error(request,"Only confirmed or active subscriptions can be invoiced.")
    elif sub.invoices.exclude(status="Cancelled").exists():
        messages.error(request,"An invoice already exists for this subscription. Avoid duplicate billing.")
    else:
        inv=Invoice(subscription=sub,due_date=timezone.localdate(),status="Confirmed")
        inv.save()
        messages.success(request,f"Invoice {inv.invoice_number} generated.")
    return redirect("subscriptions")

def payments(request):
    return render(request,"billing/payments.html",{"items":Payment.objects.select_related("invoice","invoice__subscription").order_by("-payment_date")})

def payment_add(request):
    form=PaymentForm(request.POST or None)
    if form.is_valid():
        form.save(); messages.success(request,"Payment recorded."); return redirect("payments")
    return render(request,"billing/form.html",{"form":form,"title":"Record payment"})

def invoice_status(request, pk, status):
    inv=get_object_or_404(Invoice,pk=pk)
    if status in dict(Invoice.STATUSES):
        inv.status=status; inv.save()
        messages.success(request,f"Invoice status changed to {status}.")
    return redirect("invoices")
