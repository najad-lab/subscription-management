# Brightloop Subscription Management System (Hackathon MVP)

## Requirements
- Python 3.10+
- Internet for installing Django

## Run on Windows
1. Extract the ZIP.
2. Open the extracted folder in VS Code.
3. Open Terminal and run:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations billing
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

4. Visit http://127.0.0.1:8000
5. Admin panel: http://127.0.0.1:8000/admin

## Demo sequence
1. Add Product.
2. Add Plan linked to the product.
3. Create subscription (status Confirmed or Active).
4. Click Invoice on the subscription row.
5. Record payment against the invoice.
6. Return to dashboard to show collected revenue.

## Notes
- SQLite database is created locally.
- Payment recording is simulated; no real payment gateway is connected.
- This is a hackathon prototype, not production-ready. Add authentication/authorization, audit logging, robust recurring billing scheduler, and security configuration before deployment.
