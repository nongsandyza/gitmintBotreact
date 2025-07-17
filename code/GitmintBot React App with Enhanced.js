import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  CalendarDaysIcon, PaperAirplaneIcon, PhotoIcon, ListBulletIcon, SparklesIcon,
  CheckCircleIcon, XCircleIcon, ArrowPathIcon, PencilSquareIcon, GlobeAltIcon,
  Cog6ToothIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, UserCircleIcon
} from '@heroicons/react/24/solid';

// Tailwind CSS is assumed to be available

// Main App Component
function App() {
  // Firebase configurations - REPLACE WITH YOUR ACTUAL CONFIG
  // These variables are provided by the Canvas environment.
  // For local development, you would replace these with your actual Firebase config.
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
  };

  // State variables
  const [topicText, setTopicText] = useState('');
  const [promptText, setPromptText] = useState(''); // คำแนะนำเพิ่มเติมสำหรับ AI
  const [youtubeLink, setYoutubeLink] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null); // สถานะใหม่สำหรับไฟล์เอกสาร
  const [contentSource, setContentSource] = useState('text'); // 'text', 'youtube', 'image', 'document'

  const [scheduleTime, setScheduleTime] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedFacebookPages, setSelectedFacebookPages] = useState([]);

  const [aiGeneratedContent, setAiGeneratedContent] = useState('');
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [isGeneratingAiContent, setIsGeneratingAiContent] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [scheduledPosts, setScheduledPosts] = useState([]);

  // Firebase related states
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [storage, setStorage] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Sidebar states
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedAiModel, setSelectedAiModel] = useState('gemini');
  const [aiApiKey, setAiApiKey] = useState(''); // API Key ที่ผู้ใช้ระบุสำหรับ AI Model อื่นๆ (ที่ไม่ใช่ Gemini)

  // Calendar states
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Mock Facebook Pages (ในการใช้งานจริง จะดึงมาจาก Backend API หรือ Firebase)
  const mockFacebookPages = [
    { id: 'page_id_1', name: 'เพจของฉัน 1' },
    { id: 'page_id_2', name: 'เพจของฉัน 2' },
    { id: 'page_id_3', name: 'เพจการตลาด AI' },
    { id: 'page_id_4', name: 'เพจแฟชั่น' },
    { id: 'page_id_5', name: 'เพจอาหารอร่อย' },
  ];

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      const firebaseStorage = getStorage(app);

      setDb(firestore);
      setAuth(firebaseAuth);
      setStorage(firebaseStorage);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("User signed in:", user.uid);
        } else {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
              console.log("Signed in with custom token.");
            } catch (error) {
              console.error("Error signing in with custom token:", error);
              await signInAnonymously(firebaseAuth);
              console.log("Signed in anonymously due to custom token error.");
            }
          } else {
            await signInAnonymously(firebaseAuth);
            console.log("Signed in anonymously.");
          }
          setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID());
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      showStatus('เกิดข้อผิดพลาดในการเริ่มต้น Firebase: ' + error.message, 'error');
    }
  }, []);

  // Fetch scheduled posts from Firestore in real-time
  useEffect(() => {
    if (!db || !userId || !isAuthReady) {
      console.log("Firestore not ready or user not authenticated.");
      return;
    }

    // Define the collection path for public data
    const postsCollectionPath = `artifacts/${appId}/public/data/posts_queue`;
    console.log("Listening to Firestore collection:", postsCollectionPath);

    try {
      const q = query(collection(db, postsCollectionPath), orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const posts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setScheduledPosts(posts);
        console.log("Fetched posts:", posts);
      }, (error) => {
        console.error("Error fetching posts from Firestore:", error);
        showStatus('เกิดข้อผิดพลาดในการดึงข้อมูลโพสต์: ' + error.message, 'error');
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up Firestore listener:", error);
      showStatus('เกิดข้อผิดพลาดในการตั้งค่า Listener: ' + error.message, 'error');
    }
  }, [db, userId, isAuthReady, appId]);

  // Function to display status messages
  const showStatus = useCallback((message, type) => {
    setStatusMessage({ text: message, type: type });
    setTimeout(() => {
      setStatusMessage({ text: '', type: '' });
    }, 5000);
  }, []);

  // Function to validate API Key format
  const validateApiKey = (model, key) => {
    if (!key) return true; // Allow empty key for now, validation will happen on backend or when required

    if (model === 'gemini') {
      // Basic check for Gemini API Key format (starts with AIza, typically 39 chars after that)
      return key.startsWith('AIza') && key.length >= 39;
    } else if (model === 'chatgpt') {
      // Basic check for OpenAI API Key format (starts with sk-, typically 48 chars after that)
      return key.startsWith('sk-') && key.length >= 48;
    }
    return true; // For other models or if no specific validation
  };

  // Function to generate content from AI (triggers Cloud Function via Firestore write)
  const generateContentFromAI = async () => {
    setIsGeneratingAiContent(true);
    setStatusMessage({ text: '', type: '' });
    setAiGeneratedContent('');
    setShowContentPreview(false); // Hide preview until new content is generated

    if (!topicText) {
      showStatus('กรุณากำหนดหัวข้อโพสต์', 'error');
      setIsGeneratingAiContent(false);
      return;
    }

    if (!db || !userId || !storage) {
      showStatus('Firebase ไม่พร้อมใช้งาน. โปรดตรวจสอบการเชื่อมต่อและสถานะการเข้าสู่ระบบ.', 'error');
      setIsGeneratingAiContent(false);
      return;
    }

    // Validate API Key if provided
    if (aiApiKey && !validateApiKey(selectedAiModel, aiApiKey)) {
      showStatus(`รูปแบบ API Key สำหรับ ${selectedAiModel} ไม่ถูกต้อง. โปรดตรวจสอบอีกครั้ง.`, 'error');
      setIsGeneratingAiContent(false);
      return;
    }

    try {
      let contentData = {};
      let uploadPromise = Promise.resolve(null); // Initialize with a resolved promise

      if (contentSource === 'youtube') {
        if (!youtubeLink) {
          showStatus('กรุณาใส่ลิงก์ YouTube', 'error');
          setIsGeneratingAiContent(false);
          return;
        }
        contentData = { youtubeLink: youtubeLink };
      } else if (contentSource === 'image') {
        if (!imageFile) {
          showStatus('กรุณาอัปโหลดไฟล์รูปภาพ', 'error');
          setIsGeneratingAiContent(false);
          return;
        }
        // Upload image to Firebase Storage
        uploadPromise = new Promise(async (resolve, reject) => {
          try {
            const storageRef = ref(storage, `content_uploads/${userId}/images/${imageFile.name}_${Date.now()}`);
            const uploadResult = await uploadBytes(storageRef, imageFile);
            const imageUrl = await getDownloadURL(uploadResult.ref);
            console.log('Image uploaded:', imageUrl);
            resolve({ imageUrl: imageUrl });
          } catch (error) {
            reject(error);
          }
        });
      } else if (contentSource === 'document') {
        if (!documentFile) {
          showStatus('กรุณาอัปโหลดไฟล์เอกสาร (เฉพาะ .txt)', 'error');
          setIsGeneratingAiContent(false);
          return;
        }
        // Upload document to Firebase Storage
        uploadPromise = new Promise(async (resolve, reject) => {
          try {
            // For demo, only allow .txt. In real app, handle PDF/DOCX parsing in CF.
            if (!documentFile.name.endsWith('.txt')) {
              showStatus('รองรับเฉพาะไฟล์ .txt สำหรับเอกสารในขณะนี้', 'error');
              setIsGeneratingAiContent(false);
              return;
            }
            const storageRef = ref(storage, `content_uploads/${userId}/documents/${documentFile.name}_${Date.now()}`);
            const uploadResult = await uploadBytes(storageRef, documentFile);
            const documentUrl = await getDownloadURL(uploadResult.ref);
            console.log('Document uploaded:', documentUrl);
            resolve({ documentUrl: documentUrl });
          } catch (error) {
            reject(error);
          }
        });
      } else { // contentSource === 'text'
        if (!promptText && !topicText) { // Ensure there's some text input if 'text' source
          showStatus('กรุณาใส่คำแนะนำเพิ่มเติมหรือหัวข้อโพสต์', 'error');
          setIsGeneratingAiContent(false);
          return;
        }
        contentData = { textInput: promptText };
      }

      // Wait for any file uploads to complete
      const uploadedContentData = await uploadPromise;
      if (uploadedContentData) {
        contentData = { ...contentData, ...uploadedContentData };
      }

      // Add request to Firestore, which will trigger the Cloud Function
      // The Cloud Function will read this document, call the AI, and update this document with the result.
      const aiRequestsCollectionPath = `artifacts/${appId}/public/data/ai_generation_requests`;
      const docRef = await addDoc(collection(db, aiRequestsCollectionPath), {
        topic: topicText,
        prompt: promptText, // Additional instructions
        contentSource: contentSource,
        contentData: contentData, // Contains youtubeLink, imageUrl, or documentUrl/textInput
        aiModel: selectedAiModel,
        userApiKey: aiApiKey, // ส่ง API Key ที่ผู้ใช้ระบุไปด้วย เพื่อให้ Cloud Function ใช้ (สำหรับ AI อื่นๆ)
        status: 'pending', // Initial status for Cloud Function
        userId: userId,
        createdAt: serverTimestamp()
      });

      // Listen for the result from the Cloud Function (which will update this document)
      const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
        const data = docSnapshot.data();
        if (data && data.status === 'completed') {
          setAiGeneratedContent(data.generatedContent);
          setShowContentPreview(true);
          showStatus('สร้างเนื้อหาโพสต์จาก AI สำเร็จ!', 'success');
          unsubscribe(); // Stop listening once completed
          setIsGeneratingAiContent(false);
        } else if (data && data.status === 'failed') {
          showStatus('เกิดข้อผิดพลาดในการสร้างเนื้อหาจาก AI: ' + (data.errorMessage || 'ไม่ทราบสาเหตุ'), 'error');
          unsubscribe();
          setIsGeneratingAiContent(false);
        }
      });
      // Set a timeout in case the Cloud Function fails silently or takes too long
      setTimeout(() => {
        if (isGeneratingAiContent) { // If still loading after timeout
          showStatus('การสร้างเนื้อหาใช้เวลานานเกินไป. โปรดตรวจสอบ Cloud Functions logs หรือลองอีกครั้ง.', 'error');
          setIsGeneratingAiContent(false);
          unsubscribe(); // Ensure listener is cleaned up
        }
      }, 60000); // 60 seconds timeout (increased for potential file uploads/AI processing)

    } catch (error) {
      console.error('Error initiating AI content generation:', error);
      showStatus('เกิดข้อผิดพลาดในการส่งคำขอสร้างเนื้อหา AI: ' + error.message, 'error');
      setIsGeneratingAiContent(false);
    }
  };

  // Handle final submission to Firestore (after AI content is generated)
  const handleScheduleAndPost = async () => {
    setIsSubmittingPost(true);
    setStatusMessage({ text: '', type: '' });

    if (!db || !userId || !aiGeneratedContent || selectedDates.length === 0 || selectedFacebookPages.length === 0 || !scheduleTime) {
      showStatus('ข้อมูลไม่ครบถ้วนหรือไม่พร้อมใช้งานสำหรับการโพสต์. (เนื้อหา AI, วันที่, เพจ, เวลา)', 'error');
      setIsSubmittingPost(false);
      return;
    }

    try {
      // If contentSource was 'image' and imageFile is still present, re-upload it for the final post
      // In a real production app, you might want to reference the already uploaded image URL from content_uploads
      // or ensure the AI generation process returns the final image URL to be used.
      let finalImageUrl = null;
      if (imageFile) {
        const storageRef = ref(storage, `posts_images/${userId}/${imageFile.name}_${Date.now()}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
        console.log('Final post image uploaded:', finalImageUrl);
      }


      const postsCollectionPath = `artifacts/${appId}/public/data/posts_queue`;

      // Create a post entry for each selected date and page
      for (const dateString of selectedDates) {
        const [year, month, day] = dateString.split('-').map(Number);
        const [hour, minute] = scheduleTime.split(':').map(Number);
        const scheduledDateTime = new Date(year, month - 1, day, hour, minute);

        for (const pageId of selectedFacebookPages) {
          await addDoc(collection(db, postsCollectionPath), {
            prompt: promptText, // Original prompt (additional instructions)
            topic: topicText, // Original topic
            youtube_link: youtubeLink, // Original YouTube link
            generated_content: aiGeneratedContent, // AI generated content
            schedule_time: scheduledDateTime,
            facebook_page_id: pageId, // Single page ID per doc for simplicity in CF processing
            image_url: finalImageUrl, // Final image URL for the post
            content_source_type: contentSource, // Type of source used for generation
            status: 'pending_post', // Status for Cloud Function to pick up
            userId: userId,
            ai_model_used: selectedAiModel, // Store which AI model was used
            createdAt: serverTimestamp() // Use server timestamp for consistency
          });
        }
      }

      showStatus('คำขอโพสต์ถูกกำหนดเวลาและส่งแล้ว!', 'success');
      // Clear form inputs and reset states after successful submission
      setTopicText('');
      setPromptText('');
      setYoutubeLink('');
      setImageFile(null);
      setDocumentFile(null);
      // Manually clear file inputs
      const imageUploadInput = document.getElementById('imageUpload');
      if (imageUploadInput) imageUploadInput.value = '';
      const documentUploadInput = document.getElementById('documentUpload');
      if (documentUploadInput) documentUploadInput.value = '';

      setScheduleTime(new Date().toISOString().slice(11, 16)); // Reset to current time
      setSelectedDates([]);
      setSelectedFacebookPages([]);
      setAiGeneratedContent('');
      setShowContentPreview(false);
    } catch (error) {
      console.error('Error submitting post to Firestore:', error);
      showStatus('เกิดข้อผิดพลาดในการกำหนดเวลาโพสต์: ' + error.message, 'error');
    } finally {
      setIsSubmittingPost(false);
    }
  };

  // Set current time as default for time input on component mount
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setScheduleTime(now.toISOString().slice(11, 16)); // Only time part
  }, []);

  // Calendar Logic
  const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday

  const getCalendarDays = () => {
    const numDays = daysInMonth(currentMonth, currentYear);
    const firstDay = firstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Add empty cells for preceding days
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= numDays; i++) {
      days.push(i);
    }
    return days;
  };

  const handleDateClick = (day) => {
    if (!day) return;
    const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDates(prev =>
      prev.includes(dateString)
        ? prev.filter(d => d !== dateString)
        : [...prev, dateString].sort()
    );
  };

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans relative overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 bg-gray-800 text-white w-64 p-6 transform ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out z-50 shadow-lg md:relative md:translate-x-0`}
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Cog6ToothIcon className="h-6 w-6 mr-2" /> การตั้งค่า
        </h2>

        {/* User Profile Section */}
        <div className="mb-8 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 flex items-center">
            <UserCircleIcon className="h-5 w-5 mr-2" /> โปรไฟล์ผู้ใช้
          </h3>
          <p className="text-sm text-gray-300 break-all">
            User ID: {userId || 'กำลังโหลด...'}
          </p>
          {/* สามารถเพิ่มข้อมูลเพจที่กำลังใช้งานได้ที่นี่ หากมี Logic การเลือกเพจ */}
          <p className="text-sm text-gray-300 mt-1">
            เพจที่เลือก: {selectedFacebookPages.length > 0 ? selectedFacebookPages.map(id => mockFacebookPages.find(p => p.id === id)?.name || id).join(', ') : 'ยังไม่ได้เลือก'}
          </p>
        </div>

        {/* API Settings Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <SparklesIcon className="h-5 w-5 mr-2" /> การตั้งค่า API
          </h3>
          <label htmlFor="aiModelSelect" className="block text-gray-300 text-sm font-bold mb-2">
            เลือก AI Model:
          </label>
          <select
            id="aiModelSelect"
            className="shadow-sm appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
            value={selectedAiModel}
            onChange={(e) => setSelectedAiModel(e.target.value)}
          >
            <option value="gemini">Gemini (ค่าเริ่มต้น)</option>
            <option value="chatgpt">ChatGPT (จำลอง)</option>
            {/* Add more AI options here if needed */}
          </select>
        </div>
        <div className="mb-6">
          <label htmlFor="aiApiKey" className="block text-gray-300 text-sm font-bold mb-2">
            API Key ({selectedAiModel}):
          </label>
          <input
            type="text"
            id="aiApiKey"
            className="shadow-sm appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
            placeholder="ใส่ API Key ของคุณ"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">
            สำหรับ Gemini API Key ควรถูกจัดการอย่างปลอดภัยใน Backend (เช่น Firebase Cloud Functions).
            API Key ที่นี่จะใช้สำหรับ AI Model อื่นๆ (เช่น ChatGPT จำลอง) หรือสำหรับ Gemini หากคุณต้องการระบุเอง.
          </p>
          {aiApiKey && !validateApiKey(selectedAiModel, aiApiKey) && (
            <p className="text-xs text-red-400 mt-1">
              รูปแบบ API Key ไม่ถูกต้อง! โปรดตรวจสอบอีกครั้ง.
            </p>
          )}
        </div>
        {/* Close button for mobile sidebar */}
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white md:hidden"
        >
          <XCircleIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 p-4 sm:p-6 lg:p-8 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-64' : ''}`}>
        {/* Sidebar Toggle Button for Mobile */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 left-4 bg-blue-600 text-white p-2 rounded-full shadow-lg z-40 md:hidden"
        >
          <Cog6ToothIcon className="h-6 w-6" />
        </button>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-center text-blue-600 mb-8">
            GitmintBot
          </h1>

          <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4 flex items-center">
              <SparklesIcon className="h-6 w-6 mr-2 text-blue-600" /> สร้างและกำหนดเวลาโพสต์ใหม่
            </h2>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="mb-4">
                <label htmlFor="topicText" className="block text-gray-700 text-sm font-bold mb-2">
                  หัวข้อโพสต์: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="topicText"
                  className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                  placeholder="เช่น 'ประโยชน์ของ AI ในการตลาดดิจิทัล' หรือ 'เคล็ดลับการดูแลสุขภาพในฤดูร้อน'"
                  value={topicText}
                  onChange={(e) => setTopicText(e.target.value)}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  แหล่งที่มาของเนื้อหา:
                </label>
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="contentSource"
                      value="text"
                      checked={contentSource === 'text'}
                      onChange={() => setContentSource('text')}
                    />
                    <ChatBubbleLeftRightIcon className="h-5 w-5 ml-2 mr-1 text-gray-600" />
                    <span className="ml-1 text-gray-700">ข้อความ</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="contentSource"
                      value="youtube"
                      checked={contentSource === 'youtube'}
                      onChange={() => setContentSource('youtube')}
                    />
                    <GlobeAltIcon className="h-5 w-5 ml-2 mr-1 text-gray-600" />
                    <span className="ml-1 text-gray-700">ลิงก์ YouTube</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="contentSource"
                      value="image"
                      checked={contentSource === 'image'}
                      onChange={() => setContentSource('image')}
                    />
                    <PhotoIcon className="h-5 w-5 ml-2 mr-1 text-gray-600" />
                    <span className="ml-1 text-gray-700">รูปภาพ</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="contentSource"
                      value="document"
                      checked={contentSource === 'document'}
                      onChange={() => setContentSource('document')}
                    />
                    <DocumentTextIcon className="h-5 w-5 ml-2 mr-1 text-gray-600" />
                    <span className="ml-1 text-gray-700">ไฟล์เอกสาร (.txt)</span>
                  </label>
                </div>
              </div>

              {contentSource === 'text' && (
                <div className="mb-4">
                  <label htmlFor="promptText" className="block text-gray-700 text-sm font-bold mb-2">
                    คำแนะนำเพิ่มเติมสำหรับ AI (สไตล์/เนื้อหา):
                  </label>
                  <textarea
                    id="promptText"
                    className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                    placeholder="เช่น 'ให้มีภาษาที่เป็นกันเองและน่าสนใจ ความยาวไม่เกิน 150 คำ' หรือ 'เน้นข้อมูลเชิงลึก'"
                    rows="3"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                  ></textarea>
                </div>
              )}

              {contentSource === 'youtube' && (
                <div className="mb-4">
                  <label htmlFor="youtubeLink" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    <GlobeAltIcon className="h-5 w-5 mr-2 text-gray-600" /> ลิงก์ YouTube: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    id="youtubeLink"
                    className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                    placeholder="เช่น https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    value={youtubeLink}
                    onChange={(e) => setYoutubeLink(e.target.value)}
                    required={contentSource === 'youtube'}
                  />
                  <p className="text-xs text-gray-500 mt-1">AI จะสร้างเนื้อหาที่เกี่ยวข้องกับหัวข้อของวิดีโอ</p>
                </div>
              )}

              {contentSource === 'image' && (
                <div className="mb-6">
                  <label htmlFor="imageUpload" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    <PhotoIcon className="h-5 w-5 mr-2 text-gray-600" /> อัปโหลดรูปภาพ: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    onChange={(e) => setImageFile(e.target.files[0])}
                    required={contentSource === 'image'}
                  />
                  <p className="text-xs text-gray-500 mt-1">AI จะวิเคราะห์รูปภาพเพื่อสร้างเนื้อหา</p>
                </div>
              )}

              {contentSource === 'document' && (
                <div className="mb-6">
                  <label htmlFor="documentUpload" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-600" /> อัปโหลดไฟล์เอกสาร (.txt): <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    id="documentUpload"
                    accept=".txt"
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    onChange={(e) => setDocumentFile(e.target.files[0])}
                    required={contentSource === 'document'}
                  />
                  <p className="text-xs text-gray-500 mt-1">AI จะสรุปเนื้อหาจากไฟล์ .txt</p>
                </div>
              )}

              <button
                type="button"
                onClick={generateContentFromAI}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-300 ease-in-out flex items-center justify-center"
                disabled={isGeneratingAiContent || !topicText || (contentSource === 'youtube' && !youtubeLink) || (contentSource === 'image' && !imageFile) || (contentSource === 'document' && !documentFile) || (aiApiKey && !validateApiKey(selectedAiModel, aiApiKey))}
              >
                {isGeneratingAiContent ? (
                  <>
                    <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" /> กำลังสร้างเนื้อหา...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 mr-2" /> สร้างเนื้อหาโพสต์
                  </>
                )}
              </button>

              {statusMessage.text && (
                <div
                  className={`mt-4 p-3 rounded-lg text-center text-sm font-medium ${
                    statusMessage.type === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? <CheckCircleIcon className="h-5 w-5 inline-block mr-2" /> : <XCircleIcon className="h-5 w-5 inline-block mr-2" />}
                  {statusMessage.text}
                </div>
              )}
            </form>
          </div>

          {showContentPreview && (
            <div className="mb-8 p-6 bg-purple-50 rounded-lg border border-purple-200">
              <h2 className="text-2xl font-semibold text-purple-800 mb-4 flex items-center">
                <PencilSquareIcon className="h-6 w-6 mr-2 text-purple-600" /> ตัวอย่างเนื้อหาที่ AI สร้าง
              </h2>
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <textarea
                  className="w-full text-gray-800 leading-relaxed resize-y min-h-[150px] border-none focus:ring-0 focus:outline-none"
                  value={aiGeneratedContent}
                  onChange={(e) => setAiGeneratedContent(e.target.value)}
                ></textarea>
              </div>

              {/* Calendar for Multi-Date Selection */}
              <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center">
                  <CalendarDaysIcon className="h-5 w-5 mr-2 text-gray-600" /> เลือกวันที่ต้องการโพสต์:
                </h3>
                <div className="flex justify-between items-center mb-4">
                  <button onClick={goToPreviousMonth} className="p-2 rounded-full hover:bg-gray-200">
                    <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                  </button>
                  <span className="text-lg font-semibold text-gray-800">
                    {monthNames[currentMonth]} {currentYear}
                  </span>
                  <button onClick={goToNextMonth} className="p-2 rounded-full hover:bg-gray-200">
                    <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-sm">
                  {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                    <div key={day} className="font-bold text-gray-600 p-2">{day}</div>
                  ))}
                  {getCalendarDays().map((day, index) => {
                    const dateString = day ? `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
                    const isSelected = selectedDates.includes(dateString);
                    const isToday = day && new Date().toDateString() === new Date(currentYear, currentMonth, day).toDateString();
                    return (
                      <div
                        key={index}
                        className={`p-2 rounded-lg cursor-pointer transition-colors duration-200
                          ${day ? 'hover:bg-blue-100' : 'cursor-default'}
                          ${isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-gray-50 text-gray-800'}
                          ${isToday && !isSelected ? 'border-2 border-blue-500' : ''}
                        `}
                        onClick={() => handleDateClick(day)}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-sm text-gray-700">
                  <span className="font-bold">วันที่เลือก:</span>{' '}
                  {selectedDates.length > 0 ? selectedDates.join(', ') : 'ยังไม่ได้เลือก'}
                </div>
              </div>

              <div className="mb-4">
                <label htmlFor="scheduleTimeFinal" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-gray-600" /> เวลาที่ต้องการโพสต์ (สำหรับทุกวันที่เลือก):
                </label>
                <input
                  type="time"
                  id="scheduleTimeFinal"
                  className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="facebookPageFinal" className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                  <PaperAirplaneIcon className="h-5 w-5 mr-2 text-gray-600" /> เลือก Facebook Page (เลือกได้หลายเพจ):
                </label>
                <select
                  id="facebookPageFinal"
                  multiple
                  className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out h-32"
                  value={selectedFacebookPages}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions);
                    const values = options.map(option => option.value);
                    setSelectedFacebookPages(values);
                  }}
                  required
                >
                  <option value="" disabled>-- เลือกเพจ --</option>
                  {mockFacebookPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">กด Ctrl/Cmd ค้างไว้เพื่อเลือกหลายเพจ</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={generateContentFromAI}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 transition duration-300 ease-in-out flex items-center justify-center"
                  disabled={isGeneratingAiContent}
                >
                  {isGeneratingAiContent ? (
                    <>
                      <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" /> กำลังสร้างใหม่...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="h-5 w-5 mr-2" /> ปรับแต่ง / สร้างเนื้อหาใหม่
                    </>
                  )}
                </button>
                <button
                  onClick={handleScheduleAndPost}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-300 ease-in-out flex items-center justify-center"
                  disabled={isSubmittingPost || !aiGeneratedContent || selectedDates.length === 0 || selectedFacebookPages.length === 0 || !scheduleTime}
                >
                  {isSubmittingPost ? (
                    <>
                      <ArrowPathIcon className="animate-spin h-5 w-5 mr-3" /> กำลังกำหนดเวลา...
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-5 w-5 mr-2" /> กำหนดเวลาและโพสต์
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <ListBulletIcon className="h-6 w-6 mr-2 text-gray-600" /> สถานะโพสต์ที่กำหนดเวลาไว้
            </h2>
            <div className="space-y-4">
              {scheduledPosts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  ยังไม่มีโพสต์ที่กำหนดเวลาไว้. ลองสร้างโพสต์ใหม่!
                </p>
              ) : (
                scheduledPosts.map((post) => (
                  <div key={post.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <p className="text-gray-900 font-medium mb-1">
                      <span className="font-bold">หัวข้อ:</span> {post.topic}
                    </p>
                    <p className="text-gray-600 text-sm mb-1">
                      <span className="font-bold">Prompt:</span> {post.prompt}
                    </p>
                    {post.youtube_link && (
                      <p className="text-gray-600 text-sm mb-1">
                        <span className="font-bold">ลิงก์ YouTube:</span>{' '}
                        <a href={post.youtube_link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {post.youtube_link}
                        </a>
                      </p>
                    )}
                    <p className="text-gray-600 text-sm mb-1">
                      <span className="font-bold">AI Model:</span> {post.ai_model_used || 'ไม่ระบุ'}
                    </p>
                    <p className="text-gray-600 text-sm mb-1">
                      <span className="font-bold">กำหนดเวลา:</span>{' '}
                      {post.schedule_time?.toDate ? post.schedule_time.toDate().toLocaleString('th-TH') : 'N/A'}
                    </p>
                    <p className="text-gray-600 text-sm mb-1">
                      <span className="font-bold">โพสต์ไปที่เพจ:</span>{' '}
                      {post.facebook_page_ids && post.facebook_page_ids.length > 0
                        ? post.facebook_page_ids.map(id => mockFacebookPages.find(p => p.id === id)?.name || id).join(', ')
                        : 'ไม่ระบุ'}
                    </p>
                    <p className="text-gray-600 text-sm mb-2">
                      <span className="font-bold">สถานะ:</span>{' '}
                      <span
                        className={`font-semibold ${
                          post.status === 'posted' ? 'text-green-600' :
                          post.status === 'generated' ? 'text-blue-600' :
                          post.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                        }`}
                      >
                        {post.status}
                      </span>
                    </p>
                    {post.generated_content && (
                      <p className="text-gray-700 text-sm mb-2">
                        <span className="font-bold">เนื้อหาที่ AI สร้าง:</span>{' '}
                        {post.generated_content.substring(0, 200)}{post.generated_content.length > 200 ? '...' : ''}
                      </p>
                    )}
                    {post.image_url && (
                      <p className="text-gray-700 text-sm mb-2">
                        <span className="font-bold">รูปภาพ:</span>{' '}
                        <a href={post.image_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          ดูรูปภาพ
                        </a>
                      </p>
                    )}
                    {post.error_message && (
                      <p className="text-red-500 text-xs mt-1">
                        <span className="font-bold">ข้อผิดพลาด:</span> {post.error_message}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {userId && <p className="text-xs text-gray-500 mt-4 text-center">User ID: {userId}</p>}
        </div>
      </div>
    </div>
  );
}

export default App;
