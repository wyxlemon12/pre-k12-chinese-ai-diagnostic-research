import unittest
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


class CorsPreflightTests(unittest.TestCase):
    def test_parse_endpoint_accepts_browser_preflight(self) -> None:
        client = TestClient(app)

        response = client.options(
            "/api/v1/lessons/parse",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://127.0.0.1:5173",
        )

    def test_parse_endpoint_accepts_private_network_preflight(self) -> None:
        client = TestClient(app)

        response = client.options(
            "/api/v1/lessons/parse",
            headers={
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
                "Access-Control-Request-Private-Network": "true",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-private-network"),
            "true",
        )


if __name__ == "__main__":
    unittest.main()
