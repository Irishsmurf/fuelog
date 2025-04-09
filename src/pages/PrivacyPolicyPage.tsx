// src/pages/PrivacyPolicyPage.tsx
import { JSX } from 'react';
import ReactMarkdown from 'react-markdown'; // Import the markdown renderer

// --- Privacy Policy Content ---
// Copy the Markdown content from the privacy_policy_md artifact here.
// Remember to replace placeholders like [Insert Date], [Your Name or App Name], [Your Email Address]
const privacyPolicyMarkdown = `
## Privacy Policy for Fuel Logger

**Last Updated:** April 9, 2025

Welcome to Fuelog (the "Application"). This Privacy Policy describes how Fuelog ("we," "us," or "our") collects, uses, and handles your information when you use our Application. \n\n

We are committed to protecting your privacy and ensuring transparency about how your data is handled.

### 1. Information We Collect

We collect the following types of information:

* **Account Information:** When you sign in using Google Sign-In, we receive access to basic profile information provided by Google, such as your name, email address, and profile picture. This process is handled by Firebase Authentication, and we store your unique Firebase User ID to associate your data with your account.
* **Fuel Log Data:** Information you manually enter into the Application, including:
    * Date and Time of fuel entry (Timestamp)
    * Filling Station Brand/Garage Name
    * Total Cost of Fuel
    * Distance Covered (in Kilometers)
    * Amount of Fuel Added (in Litres)
* **Location Data:** If you grant permission, the Application captures your approximate geographic coordinates (latitude, longitude) and accuracy when you save a fuel log entry. This is optional and requires your explicit consent via your browser/device prompt.
* **Imported Data:** If you use the import feature, we process the data from your uploaded TSV file (Date, Litres, Total Cost, Garage, Distance) to create fuel log entries within your account.

### 2. How We Use Your Information

Your privacy is paramount. We use the information we collect **solely for the purpose of providing the Application's features to you**, the user who owns the data. Specifically:

* To associate your fuel logs with your account.
* To display your historical fuel log data back to you within the Application (in tables, cards, etc.).
* To calculate and display fuel efficiency metrics (e.g., km/L, L/100km, MPG UK, Cost/Mile) based on *your* data for *your* viewing.
* To visualize trends in *your* fuel usage and costs through charts within *your* account.
* To potentially display *your* fuel log locations on a map or heatmap *within your account* (if location data is captured and this feature is implemented).
* To provide features like brand auto-suggestions based on *your* previous entries.

**We will NOT use your data for any other purpose.** This includes, but is not limited to:

* Sharing your data with third parties (except for the essential service providers listed below).
* Selling your data.
* Using your data for advertising or marketing.
* Aggregating your data for analysis beyond providing features directly to you.

### 3. Data Storage and Security

* Your Account Information (managed by Firebase Authentication) and Fuel Log Data (including location, if provided) are stored securely using Google's Firebase Firestore service.
* We rely on the security measures implemented by Google Cloud Platform and Firebase to protect your data. You can find more information about Firebase security [here](https://firebase.google.com/support/privacy).
* While we and our service providers take reasonable measures to protect your information, no security system is impenetrable, and we cannot guarantee the absolute security of your data.

### 4. Data Retention and Deletion

* We retain your Fuel Log Data as long as your account is active within the Application.
* **Your Right to Erasure (Deletion):** In accordance with GDPR and other privacy regulations, you have the right to request the deletion of your account and all associated Fuel Log Data. To request deletion, please contact us at [Your Email Address]. We will process your request promptly and delete all your personal data associated with the Application from our active databases, subject to any legal obligations we may have.

### 5. Your GDPR Rights

If you are located in the European Union or European Economic Area, you have certain data protection rights under the General Data Protection Regulation (GDPR), including:

* **The right to access:** You can view your Fuel Log Data directly within the Application.
* **The right to rectification:** You can correct inaccurate data using the "Edit" functionality within the Application.
* **The right to erasure:** You can request the deletion of your data as described in Section 4.
* **The right to data portability:** You can copy your data using the "Copy Table Data" feature in the Application, which provides it in a common TSV format.
* **The right to object** to processing (though our processing is limited to providing the service).
* **The right to restrict processing.**

To exercise any of these rights, please contact us at [Your Email Address].

### 6. Third-Party Services

We use the following third-party services to provide the Application:

* **Firebase (Google Cloud):** Used for Authentication (Google Sign-In), database storage (Firestore), and potentially hosting. Firebase's privacy policy can be found [here](https://firebase.google.com/support/privacy).
* **Google Sign-In:** Used for user authentication. Google's privacy policy applies to your use of your Google account.

### 7. Children's Privacy

The Application is not intended for use by children under the age of 16 (or the relevant age in your jurisdiction). We do not knowingly collect personal information from children. If you become aware that a child has provided us with personal information without parental consent, please contact us.

### 8. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy within the Application or via other appropriate means. You are advised to review this Privacy Policy periodically for any changes.

### 9. Contact Us

If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:

fuel@paddez.com`;

function PrivacyPolicyPage(): JSX.Element {
  return (
    // Container for the policy content
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border border-gray-200 dark:border-gray-700 max-w-4xl mx-auto">
      {/* Apply Tailwind typography styles using 'prose' class */}
      {/* 'prose-indigo' sets link colors, 'dark:prose-invert' adjusts colors for dark mode */}
      <article className="prose prose-indigo dark:prose-invert max-w-none">
        <ReactMarkdown>{privacyPolicyMarkdown}</ReactMarkdown>
      </article>
    </div>
  );
}

export default PrivacyPolicyPage;
