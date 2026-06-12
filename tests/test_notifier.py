"""
test_notifier.py — Unit tests for the alert notification dispatcher.
"""

import os
import pytest
from unittest.mock import patch, MagicMock
from notifier import send_notification

@patch("urllib.request.urlopen")
def test_send_notification_discord(mock_urlopen):
    # Set mock environment for discord webhook
    with patch.dict(os.environ, {"TV_NOTIFIER_DISCORD_WEBHOOK": "https://discord.com/api/webhooks/mock_test"}):
        mock_response = MagicMock()
        mock_response.read.return_value = b"ok"
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        res = send_notification("Test Alert message")
        assert "Discord" in res
        assert mock_urlopen.called

@patch("urllib.request.urlopen")
def test_send_notification_telegram(mock_urlopen):
    # Set mock environment for telegram
    env = {
        "TV_NOTIFIER_TELEGRAM_TOKEN": "12345:mock_token",
        "TV_NOTIFIER_TELEGRAM_CHAT_ID": "67890"
    }
    with patch.dict(os.environ, env):
        mock_response = MagicMock()
        mock_response.read.return_value = b'{"ok": true}'
        mock_urlopen.return_value.__enter__.return_value = mock_response
        
        res = send_notification("Test Telegram alert message")
        assert "Telegram" in res
        assert mock_urlopen.called
