import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


class MicroLessonWorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.payload = {
            "title": "团圆餐桌",
            "theme": "节日食物",
            "age_band": "6岁",
            "class_profile": "粤语和英语环境中的普通话初学者",
            "source_materials": [
                {
                    "kind": "image",
                    "title": "月饼图片卡",
                    "content": "一张摆着月饼和茶杯的课堂图片。",
                },
                {
                    "kind": "text",
                    "title": "教师短文",
                    "content": "中秋节的时候，我们会和家人一起吃月饼。",
                },
            ],
        }

    def test_create_draft_returns_complete_micro_lesson_package(self) -> None:
        response = self.client.post("/api/v1/micro-lessons/draft", json=self.payload)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "draft")
        self.assertEqual(len(data["time_blocks"]), 4)
        self.assertEqual(len(data["scaffold_paths"]), 3)
        self.assertEqual(len(data["observation_signals"]), 5)
        self.assertGreaterEqual(len(data["student_cards"]), 3)
        self.assertIn("core_question", data)

    def test_confirm_and_get_package(self) -> None:
        draft = self.client.post("/api/v1/micro-lessons/draft", json=self.payload).json()
        package_id = draft["id"]

        confirm_response = self.client.post(
            f"/api/v1/micro-lessons/{package_id}/confirm",
            json={
                "hook": "盒子里藏着一种只有特别日子才会出现的食物。",
                "core_question": "为什么有些食物会在特别的日子吃？",
            },
        )

        self.assertEqual(confirm_response.status_code, 200)
        confirmed = confirm_response.json()
        self.assertEqual(confirmed["status"], "confirmed")

        fetch_response = self.client.get(f"/api/v1/micro-lessons/{package_id}")
        self.assertEqual(fetch_response.status_code, 200)
        fetched = fetch_response.json()
        self.assertEqual(fetched["id"], package_id)
        self.assertEqual(fetched["status"], "confirmed")

    def test_classroom_signal_returns_support_recommendation(self) -> None:
        draft = self.client.post("/api/v1/micro-lessons/draft", json=self.payload).json()
        package_id = draft["id"]
        self.client.post(f"/api/v1/micro-lessons/{package_id}/confirm", json={})

        response = self.client.post(
            f"/api/v1/micro-lessons/{package_id}/classroom-signal",
            json={
                "block_id": "block-guided-talk",
                "signal_id": "needs_visual_support",
                "student_ids": ["student-moon"],
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("teacher_move", data)
        self.assertIn("recommended_path", data)
        self.assertGreaterEqual(len(data["optional_prompts"]), 2)

    def test_reflection_updates_student_cards(self) -> None:
        draft = self.client.post("/api/v1/micro-lessons/draft", json=self.payload).json()
        package_id = draft["id"]
        self.client.post(f"/api/v1/micro-lessons/{package_id}/confirm", json={})

        response = self.client.post(
            f"/api/v1/micro-lessons/{package_id}/reflect",
            json={
                "teacher_note": "小月亮需要图片支持，小灯笼已经能说出简单原因。",
                "signal_ids": ["needs_visual_support", "can_offer_reason"],
                "student_updates": [
                    {
                        "student_id": "student-moon",
                        "signal_id": "needs_visual_support",
                    },
                    {
                        "student_id": "student-lantern",
                        "signal_id": "can_offer_reason",
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("reflection_summary", data)
        self.assertGreaterEqual(len(data["next_lesson_moves"]), 2)
        moon = next(card for card in data["student_cards"] if card["id"] == "student-moon")
        lantern = next(
            card for card in data["student_cards"] if card["id"] == "student-lantern"
        )
        self.assertTrue(moon["sticky_points"])
        self.assertIn("原因", lantern["recent_performance"])

    def test_theme_specific_materials_feed_into_focus_support(self) -> None:
        response = self.client.post(
            "/api/v1/micro-lessons/draft",
            json={
                "title": "端午为什么吃粽子",
                "theme": "端午节食物",
                "age_band": "6岁",
                "class_profile": "粤语和英语环境中的普通话初学者",
                "source_materials": [
                    {
                        "kind": "image",
                        "title": "粽子图片卡",
                        "content": "一张桌上放着粽子、龙舟和一家人过节的图片。",
                    },
                    {
                        "kind": "text",
                        "title": "教师短文",
                        "content": "端午节的时候，有些家庭会一起吃粽子。粽子用叶子包着。",
                    },
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        focus_line = data["focus_support"][0]
        self.assertIn("粽子", focus_line)
        self.assertNotIn("月饼", focus_line)


if __name__ == "__main__":
    unittest.main()
