#!/usr/bin/env python3
"""BIOMED - servidor local para demostración académica. Usar solo datos ficticios."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse
import json
import threading
import socket
import datetime
import uuid
import os

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
DATA_FILE = ROOT / "data" / "biomed_demo.json"
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
LOCK = threading.RLock()
SESSIONS = {}  # Sesiones temporales; se pierden al cerrar el servidor.


def now():
    return datetime.datetime.now().isoformat(timespec="minutes")


def uid(prefix="item"):
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def initial_data():
    today = datetime.date.today()
    return {
        "users": [
            {"id": "demo-paciente", "name": "Alex Rivera (Demo)", "email": "paciente@biomed.demo", "password": "Biomed123!", "role": "paciente", "created": now(), "privacyAccepted": True},
            {"id": "demo-medico", "name": "Dra. Ana Torres (Demo)", "email": "medico@biomed.demo", "password": "Biomed123!", "role": "medico", "specialty": "Medicina familiar", "license": "DEMO-0000", "created": now(), "privacyAccepted": True}
        ],
        "patients": [{
            "userId": "demo-paciente", "name": "Alex Rivera (Demo)", "birthDate": "1985-04-12", "sex": "No especificado", "phone": "000-000-0000",
            "heightCm": 172, "weightKg": 74, "bloodType": "O+", "curp": "DATO-FICTICIO", "address": "Domicilio de demostración",
            "allergies": "Ninguna registrada (dato ficticio)", "emergencyContact": "Contacto ficticio",
            "conditions": ["Hipertensión (ejemplo académico)"], "notes": "Expediente completamente ficticio para demostración."
        }],
        "appointments": [
            {"id": "cita-1", "patientId": "demo-paciente", "doctorId": "demo-medico", "date": (today + datetime.timedelta(days=3)).isoformat(), "time": "10:00", "type": "Seguimiento general", "status": "Confirmada", "notes": "Cita de demostración."},
            {"id": "cita-2", "patientId": "demo-paciente", "doctorId": "demo-medico", "date": (today + datetime.timedelta(days=10)).isoformat(), "time": "12:30", "type": "Revisión de seguimiento", "status": "Pendiente", "notes": "Cita de demostración."}
        ],
        "records": [{"id": "rec-1", "patientId": "demo-paciente", "doctorId": "demo-medico", "date": today.isoformat(), "diagnosis": "Registro académico de ejemplo", "note": "Nota ficticia. No constituye valoración médica."}],
        "medications": [{"id": "med-1", "patientId": "demo-paciente", "doctorId": "demo-medico", "name": "Medicamento de ejemplo", "dose": "Según indicación ficticia", "frequency": "Dato demostrativo", "startDate": today.isoformat(), "endDate": "", "status": "Activo"}],
        "messages": [{"id": "msg-1", "patientId": "demo-paciente", "senderId": "demo-medico", "senderName": "Dra. Ana Torres (Demo)", "text": "Hola. Este es el chat de demostración de BIOMED.", "time": now()}],
        "referrals": [{"id": "ref-1", "patientId": "demo-paciente", "specialty": "Cardiología (ejemplo)", "reason": "Referencia simulada", "date": today.isoformat(), "status": "En espera"}],
        "rehabPlans": [],
        "metrics": {"consultations": 12, "activePatients": 8, "pendingAppointments": 3, "referrals": 2}
    }


def save_data(data):
    temp = DATA_FILE.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(DATA_FILE)


def load_data():
    if not DATA_FILE.exists():
        save_data(initial_data())
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    # Compatibilidad con archivos de versiones anteriores.
    for key, default in (("rehabPlans", []), ("messages", []), ("referrals", []), ("medications", []), ("records", []), ("appointments", []), ("patients", []), ("users", [])):
        data.setdefault(key, default)
    return data


def public_user(user):
    return {k: v for k, v in user.items() if k != "password"}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        print("[BIOMED] " + (fmt % args))

    def end_headers(self):
        # Evita que el navegador conserve una versión anterior del formulario o del JavaScript.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_json(self, obj, code=200):
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size > 1_000_000:
            raise ValueError("La solicitud excede el tamaño permitido.")
        raw = self.rfile.read(size).decode("utf-8") if size else "{}"
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("El contenido enviado no es válido.")
        return value

    def current_user(self, data):
        auth = self.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else ""
        user_id = SESSIONS.get(token)
        if not user_id:
            return None
        return next((u for u in data["users"] if u["id"] == user_id), None)

    def patient_exists(self, data, patient_id):
        return any(p["userId"] == patient_id for p in data["patients"])

    def can_access_patient(self, user, patient_id):
        return user["role"] == "medico" or (user["role"] == "paciente" and user["id"] == patient_id)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self.send_json({"ok": True, "app": "BIOMED", "mode": "demo", "time": now()})
        if parsed.path == "/api/bootstrap":
            with LOCK:
                data = load_data()
                user = self.current_user(data)
                if not user:
                    return self.send_json({"error": "Tu sesión no está activa. Inicia sesión nuevamente."}, 401)
                patient_ids = {p["userId"] for p in data["patients"]}
                if user["role"] == "medico":
                    visible = {k: data[k] for k in ("patients", "appointments", "records", "medications", "messages", "referrals", "rehabPlans", "metrics")}
                else:
                    pid = user["id"]
                    visible = {
                        "patients": [p for p in data["patients"] if p["userId"] == pid],
                        "appointments": [x for x in data["appointments"] if x.get("patientId") == pid],
                        "records": [x for x in data["records"] if x.get("patientId") == pid],
                        "medications": [x for x in data["medications"] if x.get("patientId") == pid],
                        "messages": [x for x in data["messages"] if x.get("patientId") == pid],
                        "referrals": [x for x in data["referrals"] if x.get("patientId") == pid],
                        "rehabPlans": [x for x in data["rehabPlans"] if x.get("patientId") == pid],
                        "metrics": {}
                    }
                return self.send_json({"user": public_user(user), "data": visible})
        if parsed.path.startswith("/api/"):
            return self.send_json({"error": "Ruta no encontrada."}, 404)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            body = self.read_json()
            with LOCK:
                data = load_data()
                if parsed.path == "/api/register":
                    name = str(body.get("name", "")).strip()
                    email = str(body.get("email", "")).strip().lower()
                    password = str(body.get("password", ""))
                    role = body.get("role")
                    if not body.get("privacyAccepted"):
                        return self.send_json({"error": "Debes aceptar el aviso informativo de privacidad para continuar."}, 400)
                    if not body.get("termsAccepted"):
                        return self.send_json({"error": "Debes aceptar los Términos y Condiciones de la demostración para continuar."}, 400)
                    if not name or not email or len(password) < 8 or role not in ("paciente", "medico"):
                        return self.send_json({"error": "Completa los campos. La contraseña debe tener al menos 8 caracteres."}, 400)
                    if any(u["email"] == email for u in data["users"]):
                        return self.send_json({"error": "Ese correo ya está registrado en esta demostración."}, 409)
                    user = {"id": uid("usr"), "name": name, "email": email, "password": password, "role": role, "created": now(), "privacyAccepted": True, "termsAccepted": True, "termsVersion": "1.0", "termsAcceptedAt": now()}
                    if role == "medico":
                        user["specialty"] = str(body.get("specialty", "Medicina general"))[:100]
                        user["license"] = str(body.get("license", "No proporcionada"))[:60]
                    data["users"].append(user)
                    if role == "paciente":
                        data["patients"].append({"userId": user["id"], "name": name, "birthDate": "", "sex": "", "phone": "", "heightCm": "", "weightKg": "", "bloodType": "", "curp": "", "address": "", "allergies": "", "emergencyContact": "", "conditions": [], "notes": "Perfil nuevo de demostración."})
                    save_data(data)
                    token = uuid.uuid4().hex
                    SESSIONS[token] = user["id"]
                    return self.send_json({"token": token, "user": public_user(user)}, 201)

                if parsed.path == "/api/login":
                    email = str(body.get("email", "")).strip().lower()
                    user = next((u for u in data["users"] if u["email"] == email and u["password"] == body.get("password")), None)
                    if not user:
                        return self.send_json({"error": "Correo o contraseña incorrectos."}, 401)
                    token = uuid.uuid4().hex
                    SESSIONS[token] = user["id"]
                    return self.send_json({"token": token, "user": public_user(user)})

                if parsed.path == "/api/logout":
                    auth = self.headers.get("Authorization", "")
                    token = auth[7:] if auth.startswith("Bearer ") else ""
                    SESSIONS.pop(token, None)
                    return self.send_json({"ok": True})

                user = self.current_user(data)
                if not user:
                    return self.send_json({"error": "Sesión no válida. Inicia sesión."}, 401)
                if parsed.path != "/api/action":
                    return self.send_json({"error": "Ruta no encontrada."}, 404)

                action = body.get("action")
                payload = body.get("payload") or {}
                role = user["role"]
                own_id = user["id"]

                if action == "update_profile":
                    if role != "paciente":
                        return self.send_json({"error": "Esta acción es exclusiva del perfil de paciente."}, 403)
                    patient = next((p for p in data["patients"] if p["userId"] == own_id), None)
                    if not patient:
                        return self.send_json({"error": "No se encontró tu perfil."}, 404)
                    for key in ("name", "birthDate", "sex", "phone", "heightCm", "weightKg", "address", "emergencyContact"):
                        if key in payload:
                            patient[key] = str(payload[key])[:250]
                    if "name" in payload and str(payload["name"]).strip():
                        user["name"] = str(payload["name"]).strip()[:100]
                        patient["name"] = user["name"]
                    save_data(data)

                elif action == "save_patient":
                    if role != "medico":
                        return self.send_json({"error": "Solo el personal médico puede editar el expediente clínico."}, 403)
                    pid = payload.get("userId")
                    patient = next((p for p in data["patients"] if p["userId"] == pid), None)
                    if not patient:
                        return self.send_json({"error": "Paciente no encontrado."}, 404)
                    for key in ("name", "birthDate", "sex", "phone", "heightCm", "weightKg", "bloodType", "curp", "address", "allergies", "emergencyContact", "conditions", "notes"):
                        if key in payload:
                            patient[key] = payload[key]
                    save_data(data)

                elif action == "appointment":
                    pid = payload.get("patientId")
                    if role == "paciente":
                        pid = own_id
                    elif role != "medico":
                        return self.send_json({"error": "No tienes permiso para crear citas."}, 403)
                    if not self.patient_exists(data, pid):
                        return self.send_json({"error": "Selecciona un paciente válido."}, 400)
                    item = {"id": uid("cita"), "patientId": pid, "doctorId": own_id if role == "medico" else "demo-medico", "date": str(payload.get("date", "")), "time": str(payload.get("time", "")), "type": str(payload.get("type", "Consulta general"))[:100], "status": "Pendiente", "notes": str(payload.get("notes", ""))[:500]}
                    if not item["date"] or not item["time"]:
                        return self.send_json({"error": "Indica fecha y hora."}, 400)
                    data["appointments"].append(item)
                    save_data(data)

                elif action == "appointment_status":
                    if role != "medico":
                        return self.send_json({"error": "Solo el médico puede actualizar el estado de una cita."}, 403)
                    item = next((x for x in data["appointments"] if x["id"] == payload.get("id")), None)
                    if not item:
                        return self.send_json({"error": "Cita no encontrada."}, 404)
                    if payload.get("status") not in ("Pendiente", "Confirmada", "Cancelada", "Finalizada"):
                        return self.send_json({"error": "Estado no válido."}, 400)
                    item["status"] = payload["status"]
                    save_data(data)

                elif action in ("record", "medication", "referral", "rehab_plan"):
                    if role != "medico":
                        return self.send_json({"error": "Solo el personal médico puede agregar información clínica."}, 403)
                    pid = payload.get("patientId")
                    if not self.patient_exists(data, pid):
                        return self.send_json({"error": "Paciente no encontrado."}, 404)
                    if action == "record":
                        data["records"].append({"id": uid("rec"), "patientId": pid, "doctorId": own_id, "date": str(payload.get("date") or now()[:10]), "diagnosis": str(payload.get("diagnosis", ""))[:180], "note": str(payload.get("note", ""))[:2000]})
                    elif action == "medication":
                        data["medications"].append({"id": uid("med"), "patientId": pid, "doctorId": own_id, "name": str(payload.get("name", ""))[:150], "dose": str(payload.get("dose", ""))[:150], "frequency": str(payload.get("frequency", ""))[:150], "startDate": str(payload.get("startDate") or now()[:10]), "endDate": str(payload.get("endDate", "")), "status": "Activo"})
                    elif action == "referral":
                        data["referrals"].append({"id": uid("ref"), "patientId": pid, "specialty": str(payload.get("specialty", ""))[:120], "reason": str(payload.get("reason", ""))[:800], "date": str(payload.get("date") or now()[:10]), "status": "En espera"})
                    else:
                        data["rehabPlans"].append({"id": uid("rehab"), "patientId": pid, "doctorId": own_id, "caseType": str(payload.get("caseType", "Otro caso"))[:120], "title": str(payload.get("title", "Plan de seguimiento"))[:150], "objective": str(payload.get("objective", ""))[:1000], "professionalNotes": str(payload.get("professionalNotes", ""))[:2000], "startDate": str(payload.get("startDate") or now()[:10]), "reviewDate": str(payload.get("reviewDate", "")), "status": "Activo", "created": now()})
                    save_data(data)

                elif action == "message":
                    pid = payload.get("patientId")
                    if not self.patient_exists(data, pid) or not self.can_access_patient(user, pid):
                        return self.send_json({"error": "No tienes acceso a esta conversación."}, 403)
                    content = str(payload.get("text", "")).strip()
                    if not content:
                        return self.send_json({"error": "Escribe un mensaje antes de enviarlo."}, 400)
                    data["messages"].append({"id": uid("msg"), "patientId": pid, "senderId": own_id, "senderName": user["name"], "text": content[:2000], "time": now()})
                    save_data(data)
                else:
                    return self.send_json({"error": "Acción no reconocida."}, 400)

                return self.send_json({"ok": True})
        except (ValueError, json.JSONDecodeError) as exc:
            return self.send_json({"error": str(exc) or "Solicitud no válida."}, 400)
        except Exception as exc:
            print("[BIOMED] Error:", repr(exc))
            return self.send_json({"error": "No se pudo procesar la solicitud."}, 500)


def local_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        address = sock.getsockname()[0]
    except Exception:
        address = "127.0.0.1"
    finally:
        sock.close()
    return address


if __name__ == "__main__":
    host, port = "0.0.0.0", int(os.environ.get("BIOMED_PORT", "8080"))
    with LOCK:
        if not DATA_FILE.exists():
            save_data(initial_data())
    print("=" * 62)
    print(" BIOMED | TELEMEDICINA INTEGRAL | DEMOSTRACIÓN LOCAL")
    print("=" * 62)
    print(f" En esta computadora: http://localhost:{port}")
    print(f" En la red local:     http://{local_ip()}:{port}")
    print(" Médico:   medico@biomed.demo   | Biomed123!")
    print(" Paciente: paciente@biomed.demo | Biomed123!")
    print(" Cerrar servidor: Ctrl + C")
    print(" Solo datos ficticios. No es un sistema clínico real.")
    print("=" * 62)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
