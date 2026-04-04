#!/usr/bin/env python3
"""
Comprehensive API test suite for Meeting Intelligence Hub
Tests all endpoints with example data
"""

import requests
import json
import sys
from pathlib import Path

BASE_URL = "http://localhost:8000"

# Color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

def print_test(title):
    print(f"\n{BLUE}{'='*60}")
    print(f"Testing: {title}")
    print(f"{'='*60}{RESET}")

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ {message}{RESET}")

def test_health():
    """Test /health endpoint"""
    print_test("Health Check")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print_success(f"Health check passed: {response.json()}")
            return True
        else:
            print_error(f"Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Connection error: {e}")
        return False

def test_list_projects():
    """Test GET /api/transcripts/projects"""
    print_test("List Projects")
    try:
        response = requests.get(f"{BASE_URL}/api/transcripts/projects")
        if response.status_code == 200:
            projects = response.json()
            print_success(f"Projects fetched: {projects}")
            return True, projects.get('projects', [])
        else:
            print_error(f"Failed to list projects: {response.status_code}")
            return False, []
    except Exception as e:
        print_error(f"Error: {e}")
        return False, []

def test_list_transcripts(project=None):
    """Test GET /api/transcripts/"""
    print_test("List Transcripts")
    try:
        params = {"project": project} if project else {}
        response = requests.get(f"{BASE_URL}/api/transcripts/", params=params)
        if response.status_code == 200:
            data = response.json()
            print_success(f"Transcripts fetched: {len(data['transcripts'])} total")
            if data['transcripts']:
                print_info(f"Sample transcript: {data['transcripts'][0]}")
            return True, data['transcripts']
        else:
            print_error(f"Failed to list transcripts: {response.status_code}")
            return False, []
    except Exception as e:
        print_error(f"Error: {e}")
        return False, []

def test_upload_transcript():
    """Test POST /api/transcripts/upload"""
    print_test("Upload Transcript")
    
    # Create a sample transcript
    sample_transcript = """Meeting Title: Q3 Planning
Date: 2024-09-10
Location: Conference Room A
Time: 10:00 AM
Attendees: Alice, Bob, Carol

Alice: Good morning everyone. Let's discuss our Q3 roadmap.
Bob: I agree. We need to finalize the key milestones by end of week.
Carol: I'll prepare the timeline document. Should I include the budget breakdown?
Alice: Yes, please. And let's schedule a follow-up meeting next Tuesday.
Bob: I can lead the technical requirements section.
"""
    
    try:
        files = {'files': ('test_transcript.txt', sample_transcript)}
        data = {'project': 'Test Project'}
        
        response = requests.post(f"{BASE_URL}/api/transcripts/upload", files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            if result['summary']['total_uploaded'] > 0:
                print_success(f"Transcript uploaded: {result['summary']}")
                transcript_id = result['uploaded'][0]['id']
                print_info(f"Transcript ID: {transcript_id}")
                return True, transcript_id
            else:
                print_error(f"Upload failed: {result['errors']}")
                return False, None
        else:
            print_error(f"Upload failed with status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_error(f"Error: {e}")
        return False, None

def test_get_transcript(transcript_id):
    """Test GET /api/transcripts/{transcript_id}"""
    print_test("Get Transcript Metadata")
    try:
        response = requests.get(f"{BASE_URL}/api/transcripts/{transcript_id}")
        if response.status_code == 200:
            meta = response.json()
            print_success(f"Metadata retrieved for transcript {transcript_id}")
            print_info(f"Speakers detected: {meta.get('speakers', [])}")
            print_info(f"Word count: {meta.get('word_count', 0)}")
            print_info(f"Date: {meta.get('detected_date', 'N/A')}")
            return True
        else:
            print_error(f"Failed to get transcript: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_get_transcript_text(transcript_id):
    """Test GET /api/transcripts/{transcript_id}/text"""
    print_test("Get Transcript Text")
    try:
        response = requests.get(f"{BASE_URL}/api/transcripts/{transcript_id}/text")
        if response.status_code == 200:
            data = response.json()
            text_preview = data.get('text', '')[:200]
            print_success(f"Transcript text retrieved (preview): {text_preview}...")
            return True
        else:
            print_error(f"Failed to get transcript text: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_extract(transcript_ids):
    """Test POST /api/extract/"""
    print_test("Extract Decisions & Action Items")
    try:
        payload = {"transcript_ids": transcript_ids}
        response = requests.post(f"{BASE_URL}/api/extract/", json=payload)
        
        if response.status_code == 200:
            result = response.json()
            decisions = result.get('decisions', [])
            action_items = result.get('action_items', [])
            print_success(f"Extraction completed!")
            print_info(f"Decisions found: {len(decisions)}")
            print_info(f"Action items found: {len(action_items)}")
            
            if decisions:
                print_info(f"Sample decision: {decisions[0]}")
            if action_items:
                print_info(f"Sample action item: {action_items[0]}")
            
            return True, result
        else:
            print_error(f"Extraction failed: {response.status_code} - {response.text}")
            return False, None
    except Exception as e:
        print_error(f"Error: {e}")
        return False, None

def test_get_extraction_result(transcript_id):
    """Test GET /api/extract/{transcript_id}"""
    print_test("Get Extraction Result")
    try:
        response = requests.get(f"{BASE_URL}/api/extract/{transcript_id}")
        if response.status_code == 200:
            result = response.json()
            print_success("Extraction result retrieved")
            print_info(f"Decisions: {len(result.get('decisions', []))}")
            print_info(f"Action items: {len(result.get('action_items', []))}")
            return True
        else:
            print_error(f"Failed to get result: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_export_csv(transcript_id):
    """Test GET /api/extract/{transcript_id}/export/csv"""
    print_test("Export as CSV")
    try:
        response = requests.get(f"{BASE_URL}/api/extract/{transcript_id}/export/csv")
        if response.status_code == 200:
            csv_data = response.text[:200]
            print_success("CSV export successful")
            print_info(f"CSV preview:\n{csv_data}...")
            return True
        else:
            print_error(f"Export failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_delete_transcript(transcript_id):
    """Test DELETE /api/transcripts/{transcript_id}"""
    print_test("Delete Transcript")
    try:
        response = requests.delete(f"{BASE_URL}/api/transcripts/{transcript_id}")
        if response.status_code == 200:
            result = response.json()
            print_success(f"Transcript deleted: {result}")
            return True
        else:
            print_error(f"Delete failed: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def main():
    print(f"\n{BLUE}{'='*60}")
    print("Meeting Intelligence Hub - API Test Suite")
    print(f"{'='*60}{RESET}\n")
    
    print_info(f"Testing against: {BASE_URL}")
    
    # Test 1: Health check
    if not test_health():
        print_error("Backend is not running!")
        print_info("Start the backend with: uvicorn main:app --reload")
        sys.exit(1)
    
    # Test 2: List projects
    success, projects = test_list_projects()
    
    # Test 3: List transcripts
    success, transcripts = test_list_transcripts()
    
    # Test 4: Upload transcript
    success, transcript_id = test_upload_transcript()
    if not success or not transcript_id:
        print_error("Cannot proceed without valid transcript ID")
        return
    
    # Test 5: Get transcript metadata
    test_get_transcript(transcript_id)
    
    # Test 6: Get transcript text
    test_get_transcript_text(transcript_id)
    
    # Test 7: Extract from transcript
    success, extraction_result = test_extract([transcript_id])
    
    # Test 8: Get extraction result
    test_get_extraction_result(transcript_id)
    
    # Test 9: Export as CSV
    if extraction_result:
        test_export_csv(transcript_id)
    
    # Test 10: Delete transcript (optional - commenting out to keep data)
    # test_delete_transcript(transcript_id)
    
    print(f"\n{BLUE}{'='*60}")
    print("All tests completed!")
    print(f"{'='*60}{RESET}\n")

if __name__ == "__main__":
    main()
