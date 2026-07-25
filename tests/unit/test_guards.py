from __future__ import annotations

import unittest

from skill_manager.api.guards import is_loopback_host


class IsLoopbackHostTests(unittest.TestCase):
    def test_accepts_loopback_forms(self) -> None:
        loopback_hosts = [
            "127.0.0.1",
            "127.0.0.1:8000",
            "127.0.0.2:9000",
            "localhost",
            "localhost:5173",
            "LOCALHOST:8000",
            "::1",
            "[::1]",
            "[::1]:8000",
        ]
        for host in loopback_hosts:
            with self.subTest(host=host):
                self.assertTrue(is_loopback_host(host))

    def test_rejects_remote_and_deceptive_forms(self) -> None:
        remote_hosts = [
            "",
            "   ",
            "evil.com",
            "evil.com:80",
            "127.0.0.1.evil.com",
            "localhost.evil.com",
            "0.0.0.0",
            "0.0.0.0:8000",
            "192.168.1.5",
            "10.0.0.2:8000",
            "[::]",
            "[::]:8000",
        ]
        for host in remote_hosts:
            with self.subTest(host=host):
                self.assertFalse(is_loopback_host(host))


if __name__ == "__main__":
    unittest.main()
