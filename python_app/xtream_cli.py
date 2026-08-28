#!/usr/bin/env python3
"""
Xtream Codes API Validator & Database Script (CLI Version)
Usage:
    python xtream_cli.py --file accounts.txt --threads 10 --db xtream_accounts.db
"""

import sys
import os
import argparse
import json
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Import helper functions from GUI module if in same directory, or standalone implementation
try:
    from xtream_validator_gui import DatabaseManager, parse_account_line, validate_xtream_account
except ImportError:
    # Standalone fallback if run independently
    import sqlite3
    import urllib.request
    import urllib.parse
    import re

    class DatabaseManager:
        def __init__(self, db_path="xtream_accounts.db"):
            self.db_path = db_path
            self.init_db()

        def get_connection(self):
            conn = sqlite3.connect(self.db_path)
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

    # ---------------------------------------------------------
    # Parsing Utilities
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
        lines = text.splitlines()
        accounts = []
        seen = set()
        def add_account(domain, username, password):
            if not domain or not username or not password:
                return
            key = f"{domain.lower()}|{username}|{password}"
            if key not in seen:
                seen.add(key)
                accounts.append({"domain": domain, "username": username, "password": password})
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
        if not domain.startswith("http://") and not domain.startswith("https://"):
            domain = "http://" + domain
        domain = domain.rstrip("/")
        url = f"{domain}/player_api.php?username={urllib.parse.quote(username)}&password={urllib.parse.quote(password)}"
        headers = {"User-Agent": "IPTV-Validator-Desktop/1.0"}
        req = urllib.request.Request(url, headers=headers)
        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                latency = int((time.time() - start_time) * 1000)
                raw = response.read().decode("utf-8", errors="ignore")
                data = json.loads(raw)
                user_info = data.get("user_info", {})
                server_info = data.get("server_info", {})
                auth = user_info.get("auth", 0)
                status_str = user_info.get("status", "Unknown")
                is_active = (auth == 1 and str(status_str).lower() == "active")
                exp_ts = user_info.get("exp_date")
                exp_date_fmt = "Unlimited"
                if exp_ts and str(exp_ts).isdigit():
                    try:
                        exp_dt = datetime.fromtimestamp(int(exp_ts))
                        exp_date_fmt = exp_dt.strftime("%Y-%m-%d")
                    except Exception:
                        exp_date_fmt = str(exp_ts)
                return {
                    "domain": domain,
                    "username": username,
                    "password": password,
                    "status": status_str,
                    "is_valid": is_active,
                    "exp_date": exp_date_fmt,
                    "max_connections": int(user_info.get("max_connections", 0)),
                    "active_cons": int(user_info.get("active_cons", 0)),
                    "is_trial": bool(int(user_info.get("is_trial", 0))),
                    "server_name": server_info.get("url") or domain,
                    "timezone": server_info.get("timezone", "UTC"),
                    "response_time_ms": latency,
                    "raw_data": data
                }
        except Exception as e:
            latency = int((time.time() - start_time) * 1000)
            return {
                "domain": domain,
                "username": username,
                "password": password,
                "status": "Failed",
                "is_valid": False,
                "response_time_ms": latency,
                "raw_data": {"error": str(e)}
            }

def main():
    parser = argparse.ArgumentParser(description="Xtream Codes .TXT Credential Validator & SQLite Exporter")
    parser.add_argument("--file", "-f", default="sample_accounts.txt", help="Path to .txt file with credentials")
    parser.add_argument("--db", "-d", default="xtream_accounts.db", help="SQLite database file path")
    parser.add_argument("--threads", "-t", type=int, default=10, help="Number of concurrent worker threads")
    parser.add_argument("--timeout", type=int, default=8, help="Timeout in seconds per request")
    parser.add_argument("--save-all", action="store_true", help="Save invalid/expired accounts as well")
    parser.add_argument("--export-m3u", help="Output file to write valid M3U playlist to")

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"[ERROR] File not found: {args.file}")
        sys.exit(1)

    print("=" * 65)
    print(" 🚀 Xtream Codes API Credential Validator & SQLite Database")
    print(f" Input File:   {args.file}")
    print(f" Database:     {args.db}")
    print(f" Concurrency:  {args.threads} threads | Timeout: {args.timeout}s")
    print("=" * 65)

    with open(args.file, "r", encoding="utf-8", errors="ignore") as f:
        file_content = f.read()

    accounts = parse_xtream_text(file_content)

    print(f"[*] Parsed {len(accounts)} candidate accounts from input file.")
    if not accounts:
        print("[!] No valid lines found.")
        sys.exit(0)

    db = DatabaseManager(args.db)
    valid_count = 0
    expired_count = 0
    invalid_count = 0
    valid_accounts = []

    start_all = time.time()

    with ThreadPoolExecutor(max_workers=args.threads) as executor:
        futures = {
            executor.submit(validate_xtream_account, acc["domain"], acc["username"], acc["password"], args.timeout): acc
            for acc in accounts
        }

        for i, future in enumerate(as_completed(futures), 1):
            acc_info = futures[future]
            try:
                res = future.result()
            except Exception as e:
                res = {
                    "domain": acc_info["domain"],
                    "username": acc_info["username"],
                    "password": acc_info["password"],
                    "status": "Error",
                    "is_valid": False,
                    "response_time_ms": 0
                }

            status = res.get("status", "Unknown")
            is_valid = res.get("is_valid", False)
            exp = res.get("exp_date", "-")
            max_c = res.get("max_connections", "-")
            latency = res.get("response_time_ms", 0)

            if is_valid:
                valid_count += 1
                valid_accounts.append(res)
                print(f"[{i}/{len(accounts)}] ✅ VALID   | {res['domain']} | User: {res['username']} | Exp: {exp} | Max: {max_c} ({latency}ms)")
                db.save_account(res)
            elif status == "Expired":
                expired_count += 1
                print(f"[{i}/{len(accounts)}] ⏳ EXPIRED | {res['domain']} | User: {res['username']} | Exp: {exp} ({latency}ms)")
                if args.save_all:
                    db.save_account(res)
            else:
                invalid_count += 1
                print(f"[{i}/{len(accounts)}] ❌ INVALID | {res['domain']} | User: {res['username']} | Reason: {status} ({latency}ms)")
                if args.save_all:
                    db.save_account(res)

    total_time = round(time.time() - start_all, 2)
    print("\n" + "=" * 65)
    print(" 🎉 Validation Complete!")
    print(f" Total Checked:   {len(accounts)}")
    print(f" Valid / Active:  {valid_count}")
    print(f" Expired:         {expired_count}")
    print(f" Invalid / Dead:  {invalid_count}")
    print(f" Time Taken:      {total_time} seconds")
    print(f" SQLite Saved To: {os.path.abspath(args.db)}")
    print("=" * 65)

    if args.export_m3u and valid_accounts:
        with open(args.export_m3u, "w", encoding="utf-8") as f:
            f.write("#EXTM3U\n")
            for acc in valid_accounts:
                f.write(f"#EXTINF:-1 tvg-name=\"{acc['domain']}\" group-title=\"Xtream Accounts\", {acc['domain']} ({acc['username']})\n")
                f.write(f"{acc['domain']}/get.php?username={acc['username']}&password={acc['password']}&type=m3u_plus&output=ts\n")
        print(f"[*] Exported {len(valid_accounts)} valid M3U accounts to {args.export_m3u}")

if __name__ == "__main__":
    main()
