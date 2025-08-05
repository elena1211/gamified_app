from django.shortcuts import render
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import JsonResponse


class TaskListView(APIView):
    """API view that returns task data"""
    def get(self, request):
        tasks = [
            {
                "id": 1,
                "title": "🧠 Practice Leetcode Problem",
                "tip": "Complete within 25 minutes + Document your thought process",
                "reward": "+2 Knowledge, +1 Discipline",
                "completed": False
            },
            {
                "id": 2,
                "title": "📚 Read 30 pages",
                "tip": "Focus on key concepts and take notes",
                "reward": "+3 Knowledge, +1 Discipline",
                "completed": False
            },
            {
                "id": 3,
                "title": "🏃‍♂️ 30-minute workout",
                "tip": "Include cardio and strength training",
                "reward": "+2 Energy, +1 Discipline",
                "completed": True
            }
        ]
        return Response(tasks)

class TaskDetailView(APIView):
    """API view for individual task details"""
    def get(self, request, pk):
        task = {
            "id": pk,
            "title": f"Task {pk}",
            "tip": "Sample tip",
            "reward": "+1 Point",
            "completed": False
        }
        return Response(task)
