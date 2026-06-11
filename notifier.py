import os
import sys
import json
import urllib.request
import urllib.parse
from pathlib import Path

# Ensure UTF-8 stdout
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

def send_telegram_notification(token: str, chat_id: str, message: str, filepath: str = None) -> bool:
    """Send message or photo to Telegram chat using Bot API."""
    try:
        if filepath and os.path.exists(filepath):
            # Telegram sendPhoto requires multipart/form-data
            # For simplicity with urllib, we construct the boundary body manually
            url = f"https://api.telegram.org/bot{token}/sendPhoto"
            filename = Path(filepath).name
            with open(filepath, "rb") as f:
                file_content = f.read()
                
            boundary = "----WebKitFormBoundaryTVOracleBridgeNotifier"
            parts = [
                f"--{boundary}",
                f'Content-Disposition: form-data; name="chat_id"',
                "",
                str(chat_id),
                f"--{boundary}",
                f'Content-Disposition: form-data; name="caption"',
                "",
                message,
                f"--{boundary}",
                f'Content-Disposition: form-data; name="photo"; filename="{filename}"',
                "Content-Type: image/png",
                "",
                file_content,
                f"--{boundary}--",
                ""
            ]
            
            # Combine parts into bytes
            body = bytearray()
            for p in parts[:-1]:
                if isinstance(p, str):
                    body.extend((p + "\r\n").encode("utf-8"))
                else:
                    body.extend(p)
                    body.extend(b"\r\n")
            body.extend(b"\r\n")
            
            req = urllib.request.Request(url, data=body)
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        else:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            data = urllib.parse.urlencode({
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }).encode("utf-8")
            req = urllib.request.Request(url, data=data)
            
        with urllib.request.urlopen(req, timeout=15) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res.get("ok", False)
    except Exception as e:
        print(f"[Notifier Telegram Error] {e}", file=sys.stderr)
        return False

def send_discord_notification(webhook_url: str, message: str, filepath: str = None) -> bool:
    """Send message or file attachment to Discord channel using Webhook."""
    try:
        if filepath and os.path.exists(filepath):
            filename = Path(filepath).name
            with open(filepath, "rb") as f:
                file_content = f.read()
                
            boundary = "----WebKitFormBoundaryTVOracleBridgeNotifier"
            payload = {
                "content": message
            }
            parts = [
                f"--{boundary}",
                f'Content-Disposition: form-data; name="payload_json"',
                "Content-Type: application/json",
                "",
                json.dumps(payload),
                f"--{boundary}",
                f'Content-Disposition: form-data; name="files[0]"; filename="{filename}"',
                "Content-Type: image/png",
                "",
                file_content,
                f"--{boundary}--",
                ""
            ]
            
            body = bytearray()
            for p in parts[:-1]:
                if isinstance(p, str):
                    body.extend((p + "\r\n").encode("utf-8"))
                else:
                    body.extend(p)
                    body.extend(b"\r\n")
            body.extend(b"\r\n")
            
            req = urllib.request.Request(webhook_url, data=body)
            req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
        else:
            data = json.dumps({"content": message}).encode("utf-8")
            req = urllib.request.Request(webhook_url, data=data)
            req.add_header("Content-Type", "application/json")
            # User-Agent header is required by Discord to avoid 403 Forbidden
            req.add_header("User-Agent", "TV-Oracle-Bridge-Notifier")
            
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status in (200, 204)
    except Exception as e:
        print(f"[Notifier Discord Error] {e}", file=sys.stderr)
        return False

def send_notification(message: str, filepath: str = None) -> str:
    """Dispatches message notifications to Discord and Telegram if configured."""
    discord_url = os.getenv("TV_NOTIFIER_DISCORD_WEBHOOK", "").strip()
    telegram_token = os.getenv("TV_NOTIFIER_TELEGRAM_TOKEN", "").strip()
    telegram_chat_id = os.getenv("TV_NOTIFIER_TELEGRAM_CHAT_ID", "").strip()
    
    status_reports = []
    
    if discord_url:
        ok = send_discord_notification(discord_url, message, filepath)
        status_reports.append(f"Discord: {'Sent' if ok else 'Failed'}")
        
    if telegram_token and telegram_chat_id:
        ok = send_telegram_notification(telegram_token, telegram_chat_id, message, filepath)
        status_reports.append(f"Telegram: {'Sent' if ok else 'Failed'}")
        
    if not status_reports:
        return "Warning: No notifier webhooks configured. Please set TV_NOTIFIER_DISCORD_WEBHOOK or TV_NOTIFIER_TELEGRAM_TOKEN & TV_NOTIFIER_TELEGRAM_CHAT_ID in .env."
        
    return f"Notification Dispatch Status: {', '.join(status_reports)}"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        msg = sys.argv[1]
        path_arg = sys.argv[2] if len(sys.argv) > 2 else None
        print(send_notification(msg, path_arg))
    else:
        print("Usage: python notifier.py <message> [filepath]")
