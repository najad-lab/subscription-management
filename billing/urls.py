from django.urls import path
from . import views
urlpatterns = [
 path("",views.dashboard,name="dashboard"),
 path("products/",views.products,name="products"), path("products/add/",views.product_add,name="product_add"),
 path("plans/",views.plans,name="plans"), path("plans/add/",views.plan_add,name="plan_add"),
 path("subscriptions/",views.subscriptions,name="subscriptions"), path("subscriptions/add/",views.subscription_add,name="subscription_add"),
 path("subscriptions/<int:pk>/status/<str:status>/",views.subscription_status,name="subscription_status"),
 path("subscriptions/<int:pk>/generate-invoice/",views.generate_invoice,name="generate_invoice"),
 path("invoices/",views.invoices,name="invoices"), path("invoices/add/",views.invoice_add,name="invoice_add"),
 path("invoices/<int:pk>/status/<str:status>/",views.invoice_status,name="invoice_status"),
 path("payments/",views.payments,name="payments"), path("payments/add/",views.payment_add,name="payment_add"),
]
