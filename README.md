# AeroDispatch — Cloud-Native Smart Logistics Platform

AeroDispatch is a modern logistics dispatch, parcel tracking, and fleet management platform built with React 19, Python FastAPI, and AWS cloud services.

## Live Application
- **Production URL**: [https://aerodispatch.site](https://aerodispatch.site)
- **Deployment Platform**: AWS Amplify & Amazon S3 / CloudFront
- **SSL / TLS**: Verified HTTPS via AWS Route 53 & ACM

---

## Key Features

### 👤 Customer Experience
- **Instant Parcel Booking**: Automated tariff calculation based on package dimensions and weight.
- **Live GPS Tracking**: Real-time status milestones from pickup to doorstep delivery.
- **Direct Captain Contact**: Built-in calling and messaging channels to communicate with assigned drivers.
- **Verified Customer Ratings**: Interactive 1–5 star reviews and feedback cards for completed deliveries.
- **Digital Invoices**: Instant PDF invoice generation for completed shipments.

### 🚚 Delivery Captain Hub
- **Run Sheet Manifest**: Daily stop-by-stop delivery queue with route information.
- **Proof-of-Delivery (PoD)**: Doorstep verification via customer OTP code or phone camera photo upload.
- **Exception Handling**: Quick reporting for failed delivery attempts with immediate customer alerts.
- **Performance Overview**: Read-only customer satisfaction scores and daily delivery statistics.

### 🛡️ Operations Admin Console
- **Multi-Hub Oversight**: Real-time tracking across major logistics corridors (Mumbai, Delhi, Bengaluru).
- **Driver Fleet Allocation**: Dynamic assignment of unassigned parcels to available drivers.
- **Service Level Agreement (SLA) Tracking**: Automated alerts for consignments at risk of delay.
- **Audit Logging**: Comprehensive record of all status updates and administrative overrides.

---

## System Architecture

```
  [ Customer / Captain / Admin Browser ]
                    │
                    ▼
       [ AWS Amplify / Amazon S3 ]
         (React 19 Single Page App)
                    │
                    ▼
       [ Python FastAPI Backend ]
  (State Machine & Role-Based Security)
        │           │           │
        ▼           ▼           ▼
   [DynamoDB]     [S3]        [SNS]
 (Order State)  (Photos)   (SMS Alerts)
```

### Technology Stack
- **Frontend**: React 19, Vite, Lucide Icons, Modern CSS3
- **Backend**: Python 3.12, FastAPI, Uvicorn, Pydantic v2
- **Cloud Infrastructure**: AWS Amplify, Amazon DynamoDB, Amazon S3, Amazon SNS, AWS Cognito, AWS Location Service

---

## Local Setup Guide

### Prerequisites
- Node.js (v18+)
- Python (v3.11 or v3.12)
- Git

### 1. Repository Setup
```bash
git clone https://github.com/AnilPrajapati543543/aero-dispatch.git
cd aero-dispatch
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation: `http://127.0.0.1:8000/docs`
- Health Probe: `http://127.0.0.1:8000/health`

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```
- Development Server: `http://localhost:5173`

---

## Automated Testing

```bash
# Run backend test suite (44 unit and security tests)
cd backend
pytest tests/ -v

# Run frontend build and lint verification
cd ../frontend
npm run build
npx oxlint --quiet
```

---

## Demo Credentials

| Role | Email | Access Scope |
| :--- | :--- | :--- |
| **Customer** | `customer@aerodispatch.io` | Self-service booking, tracking, reviews |
| **Delivery Captain** | `driver@aerodispatch.io` | Route run sheets, OTP verification, delivery handovers |
| **System Admin** | `admin@aerodispatch.io` | Fleet allocation, multi-hub metrics, system settings |

---

## License

This software is released under the terms of the MIT License. See [LICENSE](LICENSE) for details.
