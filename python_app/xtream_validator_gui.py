"""
Xtream Codes API Credential Validator & SQLite Database Manager
Desktop GUI Application built with Python, Tkinter, and SQLite.
"""

import sys
import os
import re
import time
import json
import sqlite3
import urllib.request
import urllib.parse
import urllib.error
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext

# ---------------------------------------------------------
# Database Handler
# ---------------------------------------------------------
class DatabaseManager:
    def __init__(self, db_path="xtream_accounts.db"):
        self.db_path = db_path
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    status TEXT NOT NULL,
                    is_valid INTEGER DEFAULT 0,
                    exp_date TEXT,
                    max_connections INTEGER DEFAULT 0,
                    active_cons INTEGER DEFAULT 0,
                    is_trial INTEGER DEFAULT 0,
                    server_name TEXT,
                    timezone TEXT,
                    response_time_ms INTEGER DEFAULT 0,
                    last_checked TEXT NOT NULL,
                    raw_data TEXT,
                    UNIQUE(domain, username, password) ON CONFLICT REPLACE
                )
            """)
            conn.commit()

    def save_account(self, account_data):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO accounts (
                    domain, username, password, status, is_valid,
                    exp_date, max_connections, active_cons, is_trial,
                    server_name, timezone, response_time_ms, last_checked, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                account_data.get("domain", ""),
                account_data.get("username", ""),
                account_data.get("password", ""),
                account_data.get("status", "Unknown"),
                1 if account_data.get("is_valid") else 0,
                account_data.get("exp_date", ""),
                account_data.get("max_connections", 0),
                account_data.get("active_cons", 0),
                1 if account_data.get("is_trial") else 0,
                account_data.get("server_name", ""),
                account_data.get("timezone", ""),
                account_data.get("response_time_ms", 0),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                json.dumps(account_data.get("raw_data", {}))
            ))
            conn.commit()

    def get_all_accounts(self, status_filter=None, search_term=None, sort_by="id", sort_order="DESC"):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            query = "SELECT * FROM accounts WHERE 1=1"
            params = []
            if status_filter and status_filter != "All":
                if status_filter == "Valid":
                    query += " AND is_valid = 1"
                elif status_filter == "Invalid":
                    query += " AND is_valid = 0"
                else:
                    query += " AND status = ?"
                    params.append(status_filter)
            if search_term:
                query += " AND (domain LIKE ? OR username LIKE ?)"
                params.extend([f"%{search_term}%", f"%{search_term}%"])
            
            # Safe Sort Order & Column
            order = "DESC" if str(sort_order).upper() == "DESC" else "ASC"
            col = str(sort_by).lower()

            if col in ("domain", "name", "host"):
                query += f" ORDER BY domain COLLATE NOCASE {order}, username COLLATE NOCASE ASC"
            elif col in ("username", "user"):
                query += f" ORDER BY username COLLATE NOCASE {order}"
            elif col in ("max_connections", "max_con", "connections"):
                query += f" ORDER BY max_connections {order}, id DESC"
            elif col in ("exp_date", "expire"):
                query += f" ORDER BY CASE WHEN exp_date IS NULL OR exp_date = '' OR exp_date = '-' THEN 1 ELSE 0 END, exp_date {order}"
            elif col in ("status", "is_valid"):
                query += f" ORDER BY is_valid {order}, status {order}"
            elif col in ("last_checked", "checked_at"):
                query += f" ORDER BY last_checked {order}"
            else:
                query += f" ORDER BY id {order}"

            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    def delete_account(self, account_id):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
            conn.commit()

    def clear_database(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM accounts")
            conn.commit()

# ---------------------------------------------------------
# Xtream Codes Line Parser & API Validator
# ---------------------------------------------------------
# Parsing & Normalization Utilities
# ---------------------------------------------------------
def normalize_domain(raw_domain):
    d = raw_domain.strip().strip("\"'<>()[];")
    d = re.sub(r'/+(?:player_api\.php|get\.php|xmltv\.php)?(?:\?.*)?$', '', d, flags=re.I)
    d = d.rstrip('/')
    d = re.sub(r'^(https?://)(?:[^@/\s]+@)(.+)$', r'\1\2', d, flags=re.I)
    if not d.startswith("http://") and not d.startswith("https://"):
        d = "http://" + d
    return d

def clean_field(val):
    v = val.strip().strip("\"'<>()[];")
    v = re.sub(r'[\s⋆*]+$', '', v)
    return v.strip()

def is_likely_domain(s):
    s = s.strip()
    if s.startswith("http://") or s.startswith("https://"):
        return True
    if re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:/.*)?$', s):
        return True
    if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:/.*)?$', s):
        return True
    return False

def is_labeled_line(line):
    return bool(re.search(r'(?:url|host|server|servidor|portal|real|ʜᴏsᴛ|username|user|usuário|usuario|użytkownik|ᴜsᴇʀ|password|pass|pas|senha|hasło|contraseña|ᴘᴀss|u==|p==|pa==|expire|data)', line, re.I))

def is_separator_or_banner(line):
    l = line.strip()
    if not l:
        return False
    if re.match(r'^[=\-_*~#+]{3,}$', l):
        return True
    if re.search(r'[🅧🅣🅡🅔🅐🅜|🅒🅞🅳🅔|xtream|m3u|💥]', l, re.I) and not extract_domain(l) and not extract_username(l) and not extract_password(l):
        return True
    return False

def extract_domain(line):
    l = line.strip()
    if not l:
        return None
    m = re.search(r'(?:^|[^\w])(?:url|host|server|servidor|portal|real|ʜᴏsᴛ|link|stream|dns|website)\s*(?:[:=➤➛➣⫸]\s*|\s+)(https?://[^\s"\'<>|]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:/[^\s"\'<>|]*)?|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:/[^\s"\'<>|]*)?)', l, re.I)
    if m:
        return normalize_domain(m.group(1))
    
    m_url = re.search(r'(https?://[^\s"\'<>|]+)', l, re.I)
    if m_url:
        return normalize_domain(m_url.group(1))

    clean_line = re.sub(r'^[^\w]+|[^\w]+$', '', l).strip()
    if is_likely_domain(clean_line) and not is_labeled_line(l):
        return normalize_domain(clean_line)
    return None

def extract_username(line):
    l = line.strip()
    if not l:
        return None
    m = re.search(r'(?:^|[^\w])(?:username|user\s*name|user|usuário|usuario|użytkownik|ᴜsᴇʀ|u==|u=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$', l, re.I)
    if m:
        raw_val = m.group(1).strip()
        if '⋆' in raw_val or ('|' in raw_val and not raw_val.startswith('|')):
            parts = [s.strip() for s in re.split(r'[⋆|]', raw_val) if s.strip()]
            if len(parts) >= 2:
                return {"username": clean_field(parts[0]), "password": clean_field(parts[1])}
        return {"username": clean_field(raw_val)}
    return None

def extract_password(line):
    l = line.strip()
    if not l:
        return None
    m = re.search(r'(?:^|[^\w])(?:password|pass\s*word|pass|pas|senha|hasło|contraseña|ᴘᴀss|p==|pa==|p=)\s*(?:[:=➤➛➣⫸=]\s*|\s+)(.+)$', l, re.I)
    if m:
        return clean_field(m.group(1))
    return None

def parse_self_contained_line(line):
    line = line.strip()
    if not line or line.startswith('#') or line.startswith('//'):
        return None
    
    if "get.php?" in line or "player_api.php?" in line:
        try:
            m_url = re.search(r'(https?://[^\s"\'<>|]+)', line, re.I)
            url_str = m_url.group(1) if m_url else line
            parsed = urllib.parse.urlparse(url_str if url_str.startswith("http") else "http://" + url_str)
            params = urllib.parse.parse_qs(parsed.query)
            user = params.get("username", params.get("user", [None]))[0]
            pwd = params.get("password", params.get("pass", [None]))[0]
            if user and pwd:
                port_part = f":{parsed.port}" if parsed.port else ""
                domain = normalize_domain(f"{parsed.scheme}://{parsed.hostname}{port_part}")
                return {"domain": domain, "username": user.strip(), "password": pwd.strip()}
        except Exception:
            pass

    m3u_match = re.search(r'(https?://[^/\s]+)/(?:live|movie|series)/([^/\s]+)/([^/\s]+)/', line, re.I)
    if m3u_match:
        domain = normalize_domain(m3u_match.group(1))
        return {"domain": domain, "username": m3u_match.group(2).strip(), "password": m3u_match.group(3).strip()}

    for delim in ["|", "\t", ",", ";"]:
        if delim in line:
            parts = [p.strip() for p in line.split(delim) if p.strip()]
            if len(parts) >= 3:
                d_cand = re.sub(r'^(?:url|host|server|real)\s*[:=➤➛➣⫸]?\s*', '', parts[0], flags=re.I)
                if is_likely_domain(d_cand):
                    return {"domain": normalize_domain(d_cand), "username": clean_field(parts[1]), "password": clean_field(parts[2])}

    if not is_labeled_line(line):
        parts = line.split()
        if len(parts) == 3 and is_likely_domain(parts[0]):
            return {"domain": normalize_domain(parts[0]), "username": clean_field(parts[1]), "password": clean_field(parts[2])}

    if not is_labeled_line(line):
        if line.startswith("http://") or line.startswith("https://"):
            proto_end = line.find("://") + 3
            rest = line[proto_end:]
            rest_parts = rest.split(":")
            if len(rest_parts) == 4:
                domain = normalize_domain(f"{line[:proto_end]}{rest_parts[0]}:{rest_parts[1]}")
                return {"domain": domain, "username": clean_field(rest_parts[2]), "password": clean_field(rest_parts[3])}
            elif len(rest_parts) == 3:
                domain = normalize_domain(f"{line[:proto_end]}{rest_parts[0]}")
                return {"domain": domain, "username": clean_field(rest_parts[1]), "password": clean_field(rest_parts[2])}
        else:
            colons = line.split(":")
            if len(colons) == 4 and is_likely_domain(f"{colons[0]}:{colons[1]}"):
                return {"domain": normalize_domain(f"http://{colons[0]}:{colons[1]}"), "username": clean_field(colons[2]), "password": clean_field(colons[3])}
            elif len(colons) == 3 and is_likely_domain(colons[0]):
                return {"domain": normalize_domain(f"http://{colons[0]}"), "username": clean_field(colons[1]), "password": clean_field(colons[2])}

    return None

def parse_account_line(line):
    return parse_self_contained_line(line)

def parse_xtream_text(text):
    """
    Universal multi-style & multi-line block parser for Xtream Codes credentials.
    Extracts accounts from raw text formatted with emojis, labels, or delimiters.
    """
    lines = text.splitlines()
    accounts = []
    seen = set()

    def add_account(domain, username, password):
        if not domain or not username or not password:
            return
        key = f"{domain.lower()}|{username}|{password}"
        if key not in seen:
            seen.add(key)
            accounts.append({
                "domain": domain,
                "username": username,
                "password": password
            })

    current_domain = None
    current_username = None
    current_password = None

    def flush_block():
        nonlocal current_domain, current_username, current_password
        if current_domain and current_username and current_password:
            add_account(current_domain, current_username, current_password)
            current_domain = None
            current_username = None
            current_password = None
            return True
        return False

    for line in lines:
        raw_line = line.strip()
        if not raw_line:
            if current_domain and current_username and current_password:
                flush_block()
            continue

        if raw_line.startswith('#') and 'http' not in raw_line:
            continue

        if is_separator_or_banner(raw_line):
            flush_block()
            continue

        single = parse_self_contained_line(raw_line)
        if single:
            flush_block()
            add_account(single["domain"], single["username"], single["password"])
            continue

        if re.match(r'^(?:expire|expiration|data\s*utworzenia|data\s*wygaśnięcia|created|creation\s*date)\s*[:=]', raw_line, re.I):
            continue

        user_obj = extract_username(raw_line)
        pass_val = extract_password(raw_line)
        domain_val = extract_domain(raw_line)

        if user_obj:
            if current_username is not None and current_password is not None and current_domain is not None:
                flush_block()
            current_username = user_obj["username"]
            if "password" in user_obj:
                current_password = user_obj["password"]
            if current_domain and current_username and current_password:
                flush_block()
            continue

        if pass_val:
            if current_password is not None and current_username is not None and current_domain is not None:
                flush_block()
            current_password = pass_val
            if current_domain and current_username and current_password:
                flush_block()
            continue

        if domain_val:
            if current_domain is not None and current_username is not None and current_password is not None:
                flush_block()
            elif current_domain is not None and (current_username is not None or current_password is not None):
                flush_block()
            current_domain = domain_val
            if current_domain and current_username and current_password:
                flush_block()
            continue

    flush_block()
    return accounts

def validate_xtream_account(domain, username, password, timeout=8):
    """
    Validates Xtream Codes credentials via player_api.php.
    Returns structured validation dictionary.
    """
    if not domain.startswith("http://") and not domain.startswith("https://"):
        domain = "http://" + domain
    domain = domain.rstrip("/")

    url = f"{domain}/player_api.php?username={urllib.parse.quote(username)}&password={urllib.parse.quote(password)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 IPTV-Client/2.0"
    }

    req = urllib.request.Request(url, headers=headers)
    start_time = time.time()

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency_ms = int((time.time() - start_time) * 1000)
            raw_text = response.read().decode("utf-8", errors="ignore")
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                return {
                    "domain": domain,
                    "username": username,
                    "password": password,
                    "status": "Non-JSON Response",
                    "is_valid": False,
                    "response_time_ms": latency_ms,
                    "raw_data": {"raw": raw_text[:300]}
                }

            user_info = data.get("user_info", {})
            server_info = data.get("server_info", {})

            auth = user_info.get("auth", 0)
            status_str = user_info.get("status", "Unknown")

            if auth == 1 and str(status_str).lower() == "active":
                exp_timestamp = user_info.get("exp_date")
                exp_date_formatted = "Unlimited"
                if exp_timestamp and str(exp_timestamp).isdigit():
                    try:
                        exp_dt = datetime.fromtimestamp(int(exp_timestamp))
                        exp_date_formatted = exp_dt.strftime("%Y-%m-%d")
                        if exp_dt < datetime.now():
                            status_str = "Expired"
                    except Exception:
                        exp_date_formatted = str(exp_timestamp)

                is_trial = bool(int(user_info.get("is_trial", 0)))
                max_con = int(user_info.get("max_connections", 0))
                active_con = int(user_info.get("active_cons", 0))
                server_name = server_info.get("url") or server_info.get("server_ip") or domain
                timezone = server_info.get("timezone", "UTC")

                return {
                    "domain": domain,
                    "username": username,
                    "password": password,
                    "status": status_str,
                    "is_valid": (status_str.lower() == "active"),
                    "exp_date": exp_date_formatted,
                    "max_connections": max_con,
                    "active_cons": active_con,
                    "is_trial": is_trial,
                    "server_name": server_name,
                    "timezone": timezone,
                    "response_time_ms": latency_ms,
                    "raw_data": data
                }
            else:
                return {
                    "domain": domain,
                    "username": username,
                    "password": password,
                    "status": status_str if status_str != "Unknown" else "Invalid Auth",
                    "is_valid": False,
                    "response_time_ms": latency_ms,
                    "raw_data": data
                }
    except urllib.error.HTTPError as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "domain": domain,
            "username": username,
            "password": password,
            "status": f"HTTP {e.code}",
            "is_valid": False,
            "response_time_ms": latency_ms,
            "raw_data": {"error": str(e)}
        }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "domain": domain,
            "username": username,
            "password": password,
            "status": "Connection Error",
            "is_valid": False,
            "response_time_ms": latency_ms,
            "raw_data": {"error": str(e)}
        }

# ---------------------------------------------------------
# Modern Tkinter GUI Desktop Application
# ---------------------------------------------------------
class XtreamValidatorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Xtream Codes Validator & Database Manager")
        self.root.geometry("1050x700")
        self.root.minsize(850, 550)

        self.db = DatabaseManager()
        self.is_validating = False
        self.stop_requested = False
        self.loaded_accounts = []
        self.db_sort_by = "id"
        self.db_sort_order = "DESC"

        self.setup_ui()
        self.refresh_database_view()

    def setup_ui(self):
        # Configure styles
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except Exception:
            pass

        # Notebook tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=8, pady=8)

        # Tab 1: Validator & Importer
        self.tab_validator = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_validator, text=" ⚡ Batch Validator & Import ")
        self.build_validator_tab()

        # Tab 2: SQLite Database Manager
        self.tab_db = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_db, text=" 🗄️ Saved Database ")
        self.build_db_tab()

        # Tab 3: Account Inspector & Quick Test
        self.tab_quick = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_quick, text=" 🔍 Single Account Test ")
        self.build_quick_test_tab()

    def build_validator_tab(self):
        # Top Controls: File selection & threads
        top_frame = ttk.LabelFrame(self.tab_validator, text=" 1. Input .TXT File / Credentials ", padding=10)
        top_frame.pack(fill="x", padx=10, pady=5)

        btn_select_file = ttk.Button(top_frame, text="📂 Browse .TXT File", command=self.select_file)
        btn_select_file.pack(side="left", padx=5)

        self.lbl_file_status = ttk.Label(top_frame, text="No file loaded. You can also paste text below.", foreground="#666")
        self.lbl_file_status.pack(side="left", padx=10)

        ttk.Label(top_frame, text="Threads:").pack(side="left", padx=(20, 2))
        self.spin_threads = ttk.Spinbox(top_frame, from_=1, to=50, width=5)
        self.spin_threads.set(10)
        self.spin_threads.pack(side="left", padx=5)

        ttk.Label(top_frame, text="Timeout (s):").pack(side="left", padx=(10, 2))
        self.spin_timeout = ttk.Spinbox(top_frame, from_=2, to=30, width=5)
        self.spin_timeout.set(8)
        self.spin_timeout.pack(side="left", padx=5)

        # Text input area
        mid_frame = ttk.Frame(self.tab_validator)
        mid_frame.pack(fill="both", expand=True, padx=10, pady=5)

        lbl_paste = ttk.Label(mid_frame, text="Input Lines (e.g. 'http://domain:80 username password' or 'domain|user|pass' or get.php URL):")
        lbl_paste.pack(anchor="w", pady=(0, 2))

        self.txt_input = scrolledtext.ScrolledText(mid_frame, height=8, font=("Consolas", 10))
        self.txt_input.pack(fill="both", expand=False, pady=2)
        self.txt_input.insert("1.0", "# Example format lines:\n# http://example-iptv.com:8080 myuser mypass\n# http://stream.net:80/get.php?username=test&password=123\n")

        # Action Buttons & Progress Bar
        action_frame = ttk.Frame(self.tab_validator, padding=5)
        action_frame.pack(fill="x", padx=10, pady=5)

        self.btn_start = ttk.Button(action_frame, text="▶ Start Validation & Save to SQLite", command=self.start_validation)
        self.btn_start.pack(side="left", padx=5)

        self.btn_stop = ttk.Button(action_frame, text="⏹ Stop", command=self.stop_validation, state="disabled")
        self.btn_stop.pack(side="left", padx=5)

        self.save_invalid_var = tk.BooleanVar(value=False)
        chk_invalid = ttk.Checkbutton(action_frame, text="Save Invalid/Errors to DB too", variable=self.save_invalid_var)
        chk_invalid.pack(side="left", padx=15)

        # Counters
        self.lbl_stats = ttk.Label(action_frame, text="Total: 0 | Valid: 0 | Expired: 0 | Invalid: 0", font=("Arial", 10, "bold"))
        self.lbl_stats.pack(side="right", padx=10)

        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self.tab_validator, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill="x", padx=10, pady=5)

        # Live Results Treeview
        log_frame = ttk.LabelFrame(self.tab_validator, text=" Validation Results (Live) ", padding=5)
        log_frame.pack(fill="both", expand=True, padx=10, pady=5)

        columns = ("domain", "username", "status", "exp_date", "max_con", "time_ms")
        self.tree_live = ttk.Treeview(log_frame, columns=columns, show="headings", height=8)
        self.tree_live.heading("domain", text="Domain / Host")
        self.tree_live.heading("username", text="Username")
        self.tree_live.heading("status", text="Status")
        self.tree_live.heading("exp_date", text="Exp Date")
        self.tree_live.heading("max_con", text="Max Con")
        self.tree_live.heading("time_ms", text="Latency (ms)")

        self.tree_live.column("domain", width=220)
        self.tree_live.column("username", width=120)
        self.tree_live.column("status", width=100)
        self.tree_live.column("exp_date", width=110)
        self.tree_live.column("max_con", width=80)
        self.tree_live.column("time_ms", width=90)

        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self.tree_live.yview)
        self.tree_live.configure(yscrollcommand=scrollbar.set)
        self.tree_live.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

    def build_db_tab(self):
        # Filter, search & sort bar
        filter_frame = ttk.Frame(self.tab_db, padding=5)
        filter_frame.pack(fill="x", padx=10, pady=5)

        ttk.Label(filter_frame, text="Filter:").pack(side="left", padx=5)
        self.combo_status = ttk.Combobox(filter_frame, values=["All", "Valid", "Active", "Expired", "Invalid"], state="readonly", width=9)
        self.combo_status.set("All")
        self.combo_status.pack(side="left", padx=3)
        self.combo_status.bind("<<ComboboxSelected>>", lambda e: self.refresh_database_view())

        ttk.Label(filter_frame, text="Sort:").pack(side="left", padx=(10, 3))
        self.combo_sort = ttk.Combobox(
            filter_frame,
            values=[
                "Newest (ID)",
                "Domain (A-Z)",
                "Domain (Z-A)",
                "Max Con (High-Low)",
                "Max Con (Low-High)",
                "Username (A-Z)",
                "Exp Date (Soonest)",
                "Status"
            ],
            state="readonly",
            width=16
        )
        self.combo_sort.set("Newest (ID)")
        self.combo_sort.pack(side="left", padx=3)
        self.combo_sort.bind("<<ComboboxSelected>>", lambda e: self.on_sort_combo_changed())

        ttk.Label(filter_frame, text="Search:").pack(side="left", padx=(10, 3))
        self.entry_search = ttk.Entry(filter_frame, width=18)
        self.entry_search.pack(side="left", padx=3)
        self.entry_search.bind("<Return>", lambda e: self.refresh_database_view())

        btn_search = ttk.Button(filter_frame, text="Search", command=self.refresh_database_view)
        btn_search.pack(side="left", padx=3)

        btn_export = ttk.Button(filter_frame, text="💾 Export", command=self.export_database)
        btn_export.pack(side="right", padx=4)

        btn_clear = ttk.Button(filter_frame, text="🗑 Clear DB", command=self.clear_db)
        btn_clear.pack(side="right", padx=4)

        btn_del_sel = ttk.Button(filter_frame, text="❌ Delete Selected", command=self.delete_selected_db)
        btn_del_sel.pack(side="right", padx=4)

        # Database Treeview
        tree_frame = ttk.Frame(self.tab_db, padding=5)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=5)

        db_columns = ("id", "domain", "username", "password", "status", "exp_date", "max_con", "checked_at")
        self.tree_db = ttk.Treeview(tree_frame, columns=db_columns, show="headings")
        
        self.db_col_names = {
            "id": "ID",
            "domain": "Domain / Host",
            "username": "Username",
            "password": "Password",
            "status": "Status",
            "exp_date": "Exp Date",
            "max_con": "Max Con",
            "checked_at": "Checked At"
        }

        for col, title in self.db_col_names.items():
            self.tree_db.heading(col, text=title, command=lambda c=col: self.on_tree_db_header_click(c))

        self.tree_db.column("id", width=50)
        self.tree_db.column("domain", width=220)
        self.tree_db.column("username", width=110)
        self.tree_db.column("password", width=110)
        self.tree_db.column("status", width=90)
        self.tree_db.column("exp_date", width=100)
        self.tree_db.column("max_con", width=80)
        self.tree_db.column("checked_at", width=140)

        db_scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree_db.yview)
        self.tree_db.configure(yscrollcommand=db_scrollbar.set)
        self.tree_db.pack(side="left", fill="both", expand=True)
        db_scrollbar.pack(side="right", fill="y")

    def build_quick_test_tab(self):
        frame = ttk.LabelFrame(self.tab_quick, text=" Quick Single Account Diagnostic ", padding=15)
        frame.pack(fill="both", expand=True, padx=15, pady=15)

        # Inputs
        grid_frame = ttk.Frame(frame)
        grid_frame.pack(fill="x", pady=10)

        ttk.Label(grid_frame, text="Server Domain / URL:").grid(row=0, column=0, sticky="w", pady=5)
        self.entry_single_domain = ttk.Entry(grid_frame, width=40)
        self.entry_single_domain.grid(row=0, column=1, sticky="w", pady=5, padx=10)
        self.entry_single_domain.insert(0, "http://example.com:8080")

        ttk.Label(grid_frame, text="Username:").grid(row=1, column=0, sticky="w", pady=5)
        self.entry_single_user = ttk.Entry(grid_frame, width=30)
        self.entry_single_user.grid(row=1, column=1, sticky="w", pady=5, padx=10)

        ttk.Label(grid_frame, text="Password:").grid(row=2, column=0, sticky="w", pady=5)
        self.entry_single_pass = ttk.Entry(grid_frame, width=30)
        self.entry_single_pass.grid(row=2, column=1, sticky="w", pady=5, padx=10)

        btn_test = ttk.Button(grid_frame, text="🚀 Test & Save to SQLite", command=self.test_single_account)
        btn_test.grid(row=3, column=1, sticky="w", pady=10, padx=10)

        # Output text box
        self.txt_single_output = scrolledtext.ScrolledText(frame, height=15, font=("Consolas", 10))
        self.txt_single_output.pack(fill="both", expand=True, pady=10)

    # ---------------------------------------------------------
    # Handlers & Actions
    # ---------------------------------------------------------
    def select_file(self):
        file_path = filedialog.askopenfilename(
            title="Select .TXT file with Xtream Codes accounts",
            filetypes=[("Text files", "*.txt"), ("M3U files", "*.m3u;*.m3u8"), ("All files", "*.*")]
        )
        if file_path:
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                self.txt_input.delete("1.0", tk.END)
                self.txt_input.insert("1.0", content)
                self.lbl_file_status.config(text=f"Loaded: {os.path.basename(file_path)}", foreground="#007700")
            except Exception as e:
                messagebox.showerror("File Error", f"Could not read file: {e}")

    def start_validation(self):
        if self.is_validating:
            return

        raw_text = self.txt_input.get("1.0", tk.END)
        accounts_to_check = parse_xtream_text(raw_text)

        if not accounts_to_check:
            messagebox.showwarning("No Accounts", "No valid account lines found in the input box or file.")
            return

        # Clear previous live results
        for row in self.tree_live.get_children():
            self.tree_live.delete(row)

        self.is_validating = True
        self.stop_requested = False
        self.btn_start.config(state="disabled")
        self.btn_stop.config(state="normal")

        threads = int(self.spin_threads.get() or 10)
        timeout = int(self.spin_timeout.get() or 8)
        save_all = self.save_invalid_var.get()

        threading.Thread(target=self.run_validation_thread, args=(accounts_to_check, threads, timeout, save_all), daemon=True).start()

    def stop_validation(self):
        self.stop_requested = True
        self.btn_stop.config(state="disabled")

    def run_validation_thread(self, accounts, max_threads, timeout, save_all):
        total = len(accounts)
        valid_cnt = 0
        expired_cnt = 0
        invalid_cnt = 0

        self.progress_var.set(0)

        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            future_to_acc = {
                executor.submit(validate_xtream_account, acc["domain"], acc["username"], acc["password"], timeout): acc
                for acc in accounts
            }

            completed = 0
            for future in as_completed(future_to_acc):
                if self.stop_requested:
                    break

                try:
                    result = future.result()
                except Exception as e:
                    result = {
                        "domain": future_to_acc[future]["domain"],
                        "username": future_to_acc[future]["username"],
                        "password": future_to_acc[future]["password"],
                        "status": "Error",
                        "is_valid": False,
                        "response_time_ms": 0
                    }

                completed += 1
                if result.get("is_valid"):
                    valid_cnt += 1
                elif result.get("status") == "Expired":
                    expired_cnt += 1
                else:
                    invalid_cnt += 1

                # Save to SQLite
                if result.get("is_valid") or save_all or result.get("status") == "Expired":
                    self.db.save_account(result)

                # Update UI safely
                self.root.after(0, self.update_live_ui, result, completed, total, valid_cnt, expired_cnt, invalid_cnt)

        self.root.after(0, self.finish_validation)

    def update_live_ui(self, result, completed, total, valid_cnt, expired_cnt, invalid_cnt):
        self.tree_live.insert("", "end", values=(
            result.get("domain", ""),
            result.get("username", ""),
            result.get("status", ""),
            result.get("exp_date", "-"),
            result.get("max_connections", "-"),
            f"{result.get('response_time_ms', 0)} ms"
        ))
        pct = (completed / total) * 100
        self.progress_var.set(pct)
        self.lbl_stats.config(text=f"Progress: {completed}/{total} | Valid: {valid_cnt} | Expired: {expired_cnt} | Invalid: {invalid_cnt}")

    def finish_validation(self):
        self.is_validating = False
        self.btn_start.config(state="normal")
        self.btn_stop.config(state="disabled")
        self.refresh_database_view()
        messagebox.showinfo("Done", "Validation completed! Valid accounts are saved in the SQLite database.")

    def on_tree_db_header_click(self, col):
        if self.db_sort_by == col:
            self.db_sort_order = "ASC" if self.db_sort_order == "DESC" else "DESC"
        else:
            self.db_sort_by = col
            if col in ("max_con", "id", "checked_at", "status"):
                self.db_sort_order = "DESC"
            else:
                self.db_sort_order = "ASC"
        self.refresh_database_view()

    def on_sort_combo_changed(self):
        val = self.combo_sort.get()
        if "Domain (A-Z)" in val:
            self.db_sort_by = "domain"
            self.db_sort_order = "ASC"
        elif "Domain (Z-A)" in val:
            self.db_sort_by = "domain"
            self.db_sort_order = "DESC"
        elif "Max Con (High-Low)" in val:
            self.db_sort_by = "max_con"
            self.db_sort_order = "DESC"
        elif "Max Con (Low-High)" in val:
            self.db_sort_by = "max_con"
            self.db_sort_order = "ASC"
        elif "Username (A-Z)" in val:
            self.db_sort_by = "username"
            self.db_sort_order = "ASC"
        elif "Exp Date (Soonest)" in val:
            self.db_sort_by = "exp_date"
            self.db_sort_order = "ASC"
        elif "Status" in val:
            self.db_sort_by = "status"
            self.db_sort_order = "DESC"
        else:
            self.db_sort_by = "id"
            self.db_sort_order = "DESC"
        self.refresh_database_view()

    def refresh_database_view(self):
        for row in self.tree_db.get_children():
            self.tree_db.delete(row)

        status = self.combo_status.get()
        search = self.entry_search.get().strip()
        accounts = self.db.get_all_accounts(
            status_filter=status,
            search_term=search,
            sort_by=self.db_sort_by,
            sort_order=self.db_sort_order
        )

        # Update column headers with sort arrow indicator
        arrow = " ▲" if self.db_sort_order == "ASC" else " ▼"
        for col, title in self.db_col_names.items():
            if col == self.db_sort_by:
                self.tree_db.heading(col, text=f"{title}{arrow}")
            else:
                self.tree_db.heading(col, text=title)

        for acc in accounts:
            self.tree_db.insert("", "end", values=(
                acc["id"],
                acc["domain"],
                acc["username"],
                acc["password"],
                acc["status"],
                acc["exp_date"] or "-",
                acc["max_connections"],
                acc["last_checked"]
            ))

    def delete_selected_db(self):
        selected_items = self.tree_db.selection()
        if not selected_items:
            messagebox.showinfo("Select Records", "Please select one or more rows to delete.")
            return

        if messagebox.askyesno("Confirm Delete", f"Delete {len(selected_items)} selected account(s) from the SQLite database?"):
            for item in selected_items:
                values = self.tree_db.item(item, "values")
                if values and len(values) > 0:
                    try:
                        acc_id = int(values[0])
                        self.db.delete_account(acc_id)
                    except Exception:
                        pass
            self.refresh_database_view()

    def clear_db(self):
        if messagebox.askyesno("Confirm Clear", "Are you sure you want to delete all saved accounts from the SQLite database?"):
            self.db.clear_database()
            self.refresh_database_view()

    def export_database(self):
        accounts = self.db.get_all_accounts()
        if not accounts:
            messagebox.showinfo("Export", "No accounts in the database to export.")
            return

        file_path = filedialog.asksaveasfilename(
            title="Export Accounts",
            defaultextension=".m3u",
            filetypes=[
                ("M3U Playlist", "*.m3u"),
                ("Text File (.txt)", "*.txt"),
                ("CSV File (.csv)", "*.csv")
            ]
        )
        if not file_path:
            return

        ext = os.path.splitext(file_path)[1].lower()
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                if ext == ".m3u":
                    f.write("#EXTM3U\n")
                    for acc in accounts:
                        if acc["is_valid"]:
                            f.write(f"#EXTINF:-1 tvg-name=\"{acc['domain']}\" group-title=\"Xtream Accounts\", {acc['domain']} ({acc['username']})\n")
                            f.write(f"{acc['domain']}/get.php?username={acc['username']}&password={acc['password']}&type=m3u_plus&output=ts\n")
                elif ext == ".csv":
                    f.write("Domain,Username,Password,Status,ExpDate,MaxConnections,CheckedAt\n")
                    for acc in accounts:
                        f.write(f"\"{acc['domain']}\",\"{acc['username']}\",\"{acc['password']}\",\"{acc['status']}\",\"{acc['exp_date']}\",{acc['max_connections']},\"{acc['last_checked']}\"\n")
                else:
                    f.write("# Xtream Codes Validator & Database Desktop - https://ais-pre-ken7kimogwkm2stztsoul5-383104743218.europe-west2.run.app\n")
                    f.write("# Format: domain username password\n\n")
                    for acc in accounts:
                        f.write(f"{acc['domain']} {acc['username']} {acc['password']}\n")

            messagebox.showinfo("Export Successful", f"Saved {len(accounts)} accounts to {os.path.basename(file_path)}")
        except Exception as e:
            messagebox.showerror("Export Failed", f"Error saving file: {e}")

    def test_single_account(self):
        domain = self.entry_single_domain.get().strip()
        user = self.entry_single_user.get().strip()
        pwd = self.entry_single_pass.get().strip()

        if not domain or not user or not pwd:
            messagebox.showwarning("Missing Fields", "Please enter domain, username, and password.")
            return

        self.txt_single_output.delete("1.0", tk.END)
        self.txt_single_output.insert("1.0", f"Testing {domain} for user '{user}'...\n\n")

        def run_test():
            res = validate_xtream_account(domain, user, pwd, timeout=10)
            self.db.save_account(res)
            formatted_json = json.dumps(res, indent=2)

            def update_box():
                self.txt_single_output.insert(tk.END, f"Status: {res.get('status')}\n")
                self.txt_single_output.insert(tk.END, f"Valid: {res.get('is_valid')}\n")
                self.txt_single_output.insert(tk.END, f"Expiration Date: {res.get('exp_date', '-')}\n")
                self.txt_single_output.insert(tk.END, f"Max Connections: {res.get('max_connections', 0)}\n")
                self.txt_single_output.insert(tk.END, f"Active Connections: {res.get('active_cons', 0)}\n")
                self.txt_single_output.insert(tk.END, f"Response Time: {res.get('response_time_ms')} ms\n\n")
                self.txt_single_output.insert(tk.END, "--- Full Raw Response ---\n")
                self.txt_single_output.insert(tk.END, formatted_json)
                self.refresh_database_view()

            self.root.after(0, update_box)

        threading.Thread(target=run_test, daemon=True).start()

# ---------------------------------------------------------
# Main Execution Entry Point
# ---------------------------------------------------------
if __name__ == "__main__":
    root = tk.Tk()
    app = XtreamValidatorApp(root)
    root.mainloop()
