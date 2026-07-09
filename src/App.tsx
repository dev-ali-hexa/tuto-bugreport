import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldError, SubmitHandler } from 'react-hook-form';
import { saveFeedback, adminSignIn, onAuthChange, adminSignOut } from './firebase';
import { AdminDashboard } from './AdminDashboard';
import { FeedbackItem, FeedbackType } from './types';

type FormValues = {
  bugTitle: string;
  bugDescription: string;
  bugScreen: string;
  device: string;
  severity: string;
  steps: string;
  expected: string;
  actual: string;
  featureTitle: string;
  featureDescription: string;
  featureReason: string;
  featureHelp: string;
  featurePriority: string;
  featureCategory: string;
  improvementArea: string;
  improvementSuggestion: string;
  appSpeed: number;
  easeOfUse: number;
  design: number;
  features: number;
  overall: number;
  issues: string[];
  generalFeedback: string;
  name: string;
  email: string;
  phone: string;
  wantsToSuggestFeature?: 'yes' | 'no';
  androidVersion?: string;
  appVersion?: string;
};

const defaultValues: FormValues = {
  bugTitle: '',
  bugDescription: '',
  bugScreen: '',
  device: '',
  severity: '',
  steps: '',
  expected: '',
  actual: '',
  featureTitle: '',
  featureDescription: '',
  featureReason: '',
  featureHelp: '',
  featurePriority: '',
  featureCategory: '',
  improvementArea: '',
  improvementSuggestion: '',
  appSpeed: 0,
  easeOfUse: 0,
  design: 0,
  features: 0,
  overall: 0,
  issues: [],
  generalFeedback: '',
  name: '',
  email: '',
  phone: '',
};

const issueOptions = [
  'App crashes',
  'Slow loading',
  'Lagging',
  'Confusing UI',
  'Login issues',
  'Notification issues',
  'Location issues',
  'Video Call issues',
  'Chat issues',
  'Other',
];

const bugScreens = ['Home', 'Search', 'Tutor Profile', 'Student Profile', 'Chat', 'Video Call', 'Groups', 'Notifications', 'Settings', 'Other'];
const featureCategories = ['AI', 'Learning', 'Chat', 'Video Call', 'Maps', 'Payments', 'Notifications', 'Community', 'Other'];
const improvementAreas = ['Home', 'Navigation', 'Search', 'Chat', 'Profile', 'Video Call', 'Groups', 'Dark Mode', 'Overall Design', 'Other'];

const StarRating = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <div className="stars">
    {[1, 2, 3, 4, 5].map((star) => (
      <button key={star} type="button" className={`star ${star <= value ? 'active' : ''}`} onClick={() => onChange(star)}>
        ★
      </button>
    ))}
  </div>
);

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};


function App() {
  const [submitted, setSubmitted] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [imageBase64s, setImageBase64s] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({ defaultValues });
  useEffect(() => {
    register('appSpeed', { min: 1 });
    register('easeOfUse', { min: 1 });
    register('design', { min: 1 });
    register('features', { min: 1 });
    register('overall', { min: 1 });
  }, [register]);
  const issues = watch('issues');
  const wantsToSuggestFeature = watch('wantsToSuggestFeature');

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        setAdminMode(true);
      } else {
        setAdminMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const onSubmit: SubmitHandler<any> = async (data) => {
    const now = new Date();
    let feedbackType: FeedbackType = 'general'; // Default
    if (data.bugTitle) feedbackType = 'bug';
    else if (data.wantsToSuggestFeature === 'yes' && data.featureTitle) feedbackType = 'feature';
    else if (data.improvementSuggestion) feedbackType = 'improvement';
    else if (data.overall > 0) feedbackType = 'performance';

    // Check if performance feedback is required and not filled
    if (feedbackType === 'performance' && (data.appSpeed === 0 || data.easeOfUse === 0 || data.design === 0 || data.features === 0 || data.overall === 0)) {
      // This will ensure that if any other field makes this a performance report, all ratings are required.
      // The validation rules on the fields will handle showing the errors.
      return; 
    }

    try {
      const item: Partial<FeedbackItem> = {
        id: now.getTime(),
        type: feedbackType,
        createdAt: now.toLocaleString(),
        updatedAt: now.toLocaleString(),
        attachments: imageBase64s.map((base64, i) => ({
          base64,
          name: imageFiles[i].name,
          type: imageFiles[i].type,
        })),
        contact: {
          name: data.name,
          email: data.email,
          phone: data.phone,
        },
        deviceInfo: {
          browser: navigator.userAgent,
          operatingSystem: navigator.platform,
          internetStatus: navigator.onLine ? 'Online' : 'Offline',
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timestamp: now.toISOString(),
          currentUrl: window.location.href,
        },
        admin: {
          status: 'Open',
        },
        ...(data.bugTitle && {
          bugReport: {
            title: data.bugTitle,
            screen: data.bugScreen,
            description: data.bugDescription,
            device: data.device,
            expectedResult: data.expected,
            actualResult: data.actual,
            stepsToReproduce: data.steps,
            androidVersion: data.androidVersion,
            appVersion: data.appVersion,
          },
        }),
        ...(data.wantsToSuggestFeature === 'yes' && {
          featureSuggestion: {
            title: data.featureTitle,
            description: data.featureDescription,
            whyNeeded: data.featureReason,
            benefit: data.featureHelp,
            priority: data.featurePriority,
            category: data.featureCategory,
          },
        }),
        ...(data.improvementSuggestion && {
          uiImprovement: {
            screen: data.improvementArea,
            suggestion: data.improvementSuggestion,
          },
        }),
        ...(data.overall > 0 && {
          performance: {
            appSpeed: data.appSpeed,
            easeOfUse: data.easeOfUse,
            design: data.design,
            features: data.features,
            overallExperience: data.overall,
            selectedIssues: data.issues,
          },
        }),
        ...(data.generalFeedback && {
          generalFeedback: data.generalFeedback,
        }),
      };

      console.log("Submitting Report:", item);

      await saveFeedback(item);
      reset(defaultValues);
      setImageFiles([]);
      setImageBase64s([]);
      setSubmitted(true);
    } catch (error) {
      console.error("Submission failed:", error);
      setProcessingMessage('Submission failed. Please try again.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setProcessingMessage(`Processing ${files.length} image(s)...`);
    setIsProcessing(true);

    const newFiles: File[] = [];
    const newBase64s: string[] = [];

    try {
      await Promise.all(files.map(async (file) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          console.warn(`Skipping invalid file type: ${file.name}`);
          return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10 MB
          console.warn(`Skipping large file: ${file.name}`);
          return;
        }

        const compressedBase64 = await compressImage(file);
        newFiles.push(file);
        newBase64s.push(compressedBase64);
      }));

      setImageFiles(prev => [...prev, ...newFiles]);
      setImageBase64s(prev => [...prev, ...newBase64s]);
      setProcessingMessage(`${newFiles.length} image(s) ready for submission.`);
    } catch (error) {
      console.error('Image compression failed:', error);
      setProcessingMessage('Image processing failed. Please try another image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdminLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdminError('');
    try {
      await adminSignIn(adminEmail, adminPassword);
      setAdminLoginOpen(false);
    } catch (error: any) {
      console.error("Admin login failed:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        setAdminError('Invalid credentials. Please try again.');
      } else {
        setAdminError('An unexpected error occurred.');
      }
    }
  };

  const renderRequiredLabel = (label: string, error?: FieldError) => (
    <span className={`field-label ${error ? 'field-error' : ''}`}>
      {label}
      <span className="required"> *</span>
    </span>
  );

  if (adminMode) {
    return <AdminDashboard onLogout={async () => {
      await adminSignOut();
      // The onAuthChange listener will set adminMode to false
    }} />;
  }

  if (submitted) {
    return (
      <div className="app-shell">
        <div className="success-modal" style={{ margin: 'auto' }}>
          <div className="success-icon">✓</div>
          <h3>Form has been submitted. Thanks for taking your time!</h3>
          <p>You can submit another form if you find a bug or want to suggest a new feature.</p>
          <div className="login-actions">
            <button type="button" className="submit-btn" onClick={() => setSubmitted(false)}>Submit Another Form</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="role-pill">User Mode</div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setAdminLoginOpen(true);
          }}
        >
          Admin
        </button>
      </div>
      <header className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">🐞 TutoMap Beta Feedback</p>
          <h1>Help us build a smoother, smarter TutoMap experience.</h1>
          <p>Report bugs, suggest features, share UX improvements, and rate your experience after testing the app.</p>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orb orb-one"></div>
          <div className="orb orb-two"></div>
          <div className="bug-card">
            <img src="/WhatsApp Image 2026-06-17 at 3.48.32 PM.jpeg" alt="TutoMap logo" className="logo-image" />
            <div>
              <strong>Feedback</strong>
              <p>Every report helps improve TutoMap.</p>
            </div>
          </div>
        </div>
      </header>

      <form className="feedback-form" onSubmit={handleSubmit(onSubmit)}>
        <section className="section-card">
          <div className="section-title">
            <h2>1. Report a Bug</h2>
            <p>Tell us what broke and how it happened.</p>
          </div>
          <div className="grid two">
            <label>
              {renderRequiredLabel('Bug Title', errors.bugTitle)}
              <input {...register('bugTitle', { required: true })} placeholder="Title" className={errors.bugTitle ? 'input-error' : ''} />
            </label>
            <label>
              {renderRequiredLabel('Which screen/page?', errors.bugScreen)}
              <select {...register('bugScreen', { required: true })} className={errors.bugScreen ? 'input-error' : ''}>
                <option value="" disabled>Select a screen...</option>
                {bugScreens.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <label>
            {renderRequiredLabel('Bug Description', errors.bugDescription)}
            <textarea {...register('bugDescription', { required: true })} rows={4} placeholder="Describe the problem clearly..." className={errors.bugDescription ? 'input-error' : ''} />
          </label>
          <div className="grid two">
            <label>
              {renderRequiredLabel('Device', errors.device)}
              <input {...register('device', { required: true })} placeholder="e.g. poco x7 pro" className={errors.device ? 'input-error' : ''} />
            </label>
          </div>
          <div className="grid two">
            <label>
              {renderRequiredLabel('Expected Result', errors.expected)}
              <textarea {...register('expected', { required: true })} rows={3} />
            </label>
            <label>
              {renderRequiredLabel('Actual Result', errors.actual)}
              <textarea {...register('actual', { required: true })} rows={3} />
            </label>
          </div>
          <label className="upload-box">
            Upload Screenshot / Image
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} multiple />
          </label>
          {isProcessing && (
            <div className="upload-progress-block">
              <div className="upload-progress-bar" aria-hidden="true">
                <div className="upload-progress-fill indeterminate" />
              </div>
              <p className="uploading-text">{processingMessage}</p>
            </div>
          )}
          {processingMessage && !isProcessing && <p className="upload-success-text">{processingMessage}</p>}
          <div className="grid three">
            <label>Android Version<input {...register('androidVersion')} placeholder="e.g. 15" /></label>
            <label>App Version<input {...register('appVersion')} placeholder="e.g. right now version 1.0 beta" /></label>
            
          </div>
        </section>

        <section className="section-card">
          <div className="section-title">
            <h2>2. Suggest a New Feature</h2>
            <p>Tell us what idea you want to share with TutoMap.</p>
          </div>

          <div className="type-group">
            <p>Would you like to suggest a new feature?</p>
            <label className="type-option">
              <input type="radio" {...register('wantsToSuggestFeature')} value="yes" /> Yes
            </label>
            <label className="type-option">
              <input type="radio" {...register('wantsToSuggestFeature')} value="no" /> No
            </label>
          </div>

          {wantsToSuggestFeature === 'yes' && (
            <div className="feature-panel">
              <div className="feature-prompt">
                <h3>We'd love to hear your idea</h3>
                <p>Tell us what feature you would like to see in TutoMap and how it can help students or tutors.</p>
              </div>

              <label>
                {renderRequiredLabel('Feature Title', errors.featureTitle)}
                <input {...register('featureTitle', { required: wantsToSuggestFeature === 'yes' })} placeholder="Feature Title" />
              </label>
              <label>
                {renderRequiredLabel('Describe your feature idea', errors.featureDescription)}
                <textarea {...register('featureDescription', { required: wantsToSuggestFeature === 'yes' })} rows={4} placeholder="Explain the feature..." />
              </label>
              <label>
                {renderRequiredLabel('Why should this feature be added?', errors.featureReason)}
                <textarea {...register('featureReason', { required: wantsToSuggestFeature === 'yes' })} rows={3} />
              </label>
              <label>
                {renderRequiredLabel('How will it help students or tutors?', errors.featureHelp)}
                <textarea {...register('featureHelp', { required: wantsToSuggestFeature === 'yes' })} rows={3} />
              </label>
              <div className="grid two">
                <label>
                  {renderRequiredLabel('Priority', errors.featurePriority)}
                  <select {...register('featurePriority', { required: wantsToSuggestFeature === 'yes' })}>
                    <option value="" disabled>Select priority...</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </label>
                <label>
                  {renderRequiredLabel('Category', errors.featureCategory)}
                  <select {...register('featureCategory', { required: wantsToSuggestFeature === 'yes' })}>
                    <option value="" disabled>Select a category...</option>
                    {featureCategories.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}
        </section>

        <section className="section-card">
          <div className="section-title">
            <h2>3. UI/UX Improvement Suggestions</h2>
            <p>Let us know what should feel better.</p>
          </div>
          <label>
            Which part of the app should be improved?
            <select {...register('improvementArea')}>
              <option value="" disabled>Select an area...</option>
              {improvementAreas.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Suggestion
            <textarea {...register('improvementSuggestion')} rows={4} placeholder="Share your UI/UX idea..." />
          </label>
        </section>

        <section className="section-card">
          <div className="section-title">
            <h2>4. Performance Feedback</h2>
            <p>Rate your experience and flag issues.</p>
          </div>
          <div className="rating-grid">
            <label className={errors.appSpeed ? 'field-error' : ''}>{renderRequiredLabel('App Speed', errors.appSpeed)}<StarRating value={watch('appSpeed')} onChange={(value) => setValue('appSpeed', value, { shouldValidate: true })} /></label>
            <label className={errors.easeOfUse ? 'field-error' : ''}>{renderRequiredLabel('Ease of Use', errors.easeOfUse)}<StarRating value={watch('easeOfUse')} onChange={(value) => setValue('easeOfUse', value, { shouldValidate: true })} /></label>
            <label className={errors.design ? 'field-error' : ''}>{renderRequiredLabel('Design', errors.design)}<StarRating value={watch('design')} onChange={(value) => setValue('design', value, { shouldValidate: true })} /></label>
            <label className={errors.features ? 'field-error' : ''}>{renderRequiredLabel('Features', errors.features)}<StarRating value={watch('features')} onChange={(value) => setValue('features', value, { shouldValidate: true })} /></label>
            <label className={errors.overall ? 'field-error' : ''}>{renderRequiredLabel('Overall Experience', errors.overall)}<StarRating value={watch('overall')} onChange={(value) => setValue('overall', value, { shouldValidate: true })} /></label>
          </div>
          <div className="chip-grid">
            {issueOptions.map((option) => (
              <label key={option} className="chip">
                <input type="checkbox" value={option} checked={issues?.includes(option)} onChange={(event) => {
                  const current = issues || [];
                  const next = event.target.checked ? [...current, option] : current.filter((item) => item !== option);
                  setValue('issues', next);
                }} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-title">
            <h2>5. General Feedback</h2>
            <p>Anything else you want us to know?</p>
          </div>
          <label>
            General Feedback
            <textarea {...register('generalFeedback')} rows={5} placeholder="Tell us anything that can help improve TutoMap..." />
          </label>
        </section>

        <section className="section-card">
          <div className="section-title">
            <h2>6. Contact Information</h2>
            <p>Optional, only if you want a follow-up.</p>
          </div>
          <div className="grid three">
            <label>
              {renderRequiredLabel('Name', errors.name)}
              <input {...register('name', { required: 'Name is required' })} className={errors.name ? 'input-error' : ''} />
            </label>
            <label>
              {renderRequiredLabel('Email', errors.email)}
              <input type="email" {...register('email', { required: 'Email is required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} className={errors.email ? 'input-error' : ''} />
            </label>
            <label>Phone (Optional)<input {...register('phone')} /></label>
          </div>
        </section>

        <button type="submit" className="submit-btn" disabled={isProcessing}>{isProcessing ? 'Processing...' : 'Submit Feedback'}</button>
      </form>

      {adminLoginOpen && (
        <div className="login-overlay">
          <div className="login-card">
            <h3>Admin Login</h3>
            <form onSubmit={handleAdminLogin} className="login-form">
              <label>
                Email
                <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="admin" />
              </label>
              <label>
                Password
                <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="ali" />
              </label>
              {adminError && <p className="error-text">{adminError}</p>}
              <div className="login-actions">
                <button type="submit" className="submit-btn">Open Admin Panel</button>
                <button type="button" className="secondary-btn" onClick={() => setAdminLoginOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="page-footer">
        <span>Developer: Ali/CodeDcode Service  </span>
        <span>{adminMode ? 'Admin Panel Active' : 'User View'}</span>
      </footer>
    </div>
  );
}

export default App;
