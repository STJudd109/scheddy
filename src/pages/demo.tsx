import React, { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Sample community configurations for the demo
const DEMO_COMMUNITIES = [
  {
    id: 'sunnyacres',
    name: 'Sunny Acres Assisted Living',
    color: '#0066cc',
    logo: '/logo.svg',
    description: 'A peaceful community with beautiful gardens and modern amenities.'
  },
  {
    id: 'oakwoodestates',
    name: 'Oakwood Estates',
    color: '#2c5e2e',
    logo: '/logo.svg',
    description: 'Luxury independent living surrounded by nature and walking trails.'
  },
  {
    id: 'harborlights',
    name: 'Harbor Lights Senior Living',
    color: '#1e3a8a',
    logo: '/logo.svg',
    description: 'Waterfront views with a focus on active lifestyles and wellness.'
  },
  {
    id: 'custom',
    name: 'Custom Configuration',
    color: '#9333ea',
    logo: '/logo.svg',
    description: 'Try your own custom settings with our interactive configurator.'
  }
];

/**
 * Demo page for the Appointment Form embedding
 */
export default function DemoPage() {
  // State for the selected community
  const [selectedCommunity, setSelectedCommunity] = useState(DEMO_COMMUNITIES[0]);
  
  // State for the custom configuration form
  const [customConfig, setCustomConfig] = useState({
    communityName: 'Your Community Name',
    primaryColor: '#9333ea',
    logoUrl: '/logo.svg',
    buttonText: 'Schedule a Visit'
  });
  
  // Reference to the iframe container
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  
  // Handle community selection
  const handleCommunityChange = (communityId: string) => {
    const community = DEMO_COMMUNITIES.find(c => c.id === communityId);
    if (community) {
      setSelectedCommunity(community);
      
      // Clear any existing iframe
      if (iframeContainerRef.current) {
        iframeContainerRef.current.innerHTML = '';
        
        // If not the custom config, create a new iframe
        if (communityId !== 'custom') {
          renderIframe(community);
        }
      }
    }
  };
  
  // Handle custom configuration changes
  const handleCustomConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomConfig(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Apply custom configuration
  const applyCustomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Update the selected community with custom values
    setSelectedCommunity({
      ...selectedCommunity,
      name: customConfig.communityName,
      color: customConfig.primaryColor,
      logo: customConfig.logoUrl
    });
    
    // Re-render the iframe with custom config
    if (iframeContainerRef.current) {
      iframeContainerRef.current.innerHTML = '';
      renderIframe({
        id: 'custom',
        name: customConfig.communityName,
        color: customConfig.primaryColor,
        logo: customConfig.logoUrl,
        description: 'Your custom configuration'
      });
    }
  };
  
  // Function to render the iframe for a community
  const renderIframe = (community: typeof DEMO_COMMUNITIES[0]) => {
    if (!iframeContainerRef.current) return;
    
    // Create iframe element
    const iframe = document.createElement('iframe');
    iframe.src = `/embed?community=${encodeURIComponent(community.name)}&primaryColor=${encodeURIComponent(community.color)}&logoUrl=${encodeURIComponent(community.logo)}`;
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '8px';
    iframe.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    
    // Append to container
    iframeContainerRef.current.appendChild(iframe);

    /* ----------------------------------------------------------
     * Auto-resize handler – listens for postMessage events sent
     * by the embedded form (`type:"resize", height`).
     * -------------------------------------------------------- */
    function onMessage(event: MessageEvent) {
      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'resize' && data.height) {
          iframe.style.height = `${Math.ceil(data.height)}px`;
        }
      } catch {
        /* ignore */
      }
    }

    window.addEventListener('message', onMessage);
    // Clean up when a new iframe is rendered
    iframe.addEventListener('load', () => {
      // ensure listener exists for future messages
      window.addEventListener('message', onMessage);
    });
  };
  
  // Generate the embed code for the current configuration
  const generateEmbedCode = (community: typeof DEMO_COMMUNITIES[0]) => {
    const scriptCode = `<script 
  src="${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/embed.js" 
  data-community="${community.name}"
  data-color="${community.color}"
  data-logo="${community.logo}"
  data-target="#appointment-form-container"
  data-schedule-provider="calendly"
  data-booking-url="https://calendly.com/your-link"
  data-schedule-optional="true"
  data-thankyou-suffix="/"
></script>

<div id="appointment-form-container"></div>`;

    return scriptCode;
  };

  // Generate the JavaScript API code
  const generateJsApiCode = (community: typeof DEMO_COMMUNITIES[0]) => {
    const jsCode = `// Initialize with global config
window.AppointmentFormConfig = {
  communityName: "${community.name}",
  primaryColor: "${community.color}",
  logoUrl: "${community.logo}",
  target: "#appointment-form-container",
  
  // Optional callbacks
  onSubmit: function(data) {
    console.log("Form submitted:", data);
  },
  onError: function(error) {
    console.error("Form error:", error);
  }
};

// Later, you can update the configuration
AppointmentForm.reload({
  communityName: "Updated Community Name",
  primaryColor: "#ff0000"
});`;

    return jsCode;
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Appointment Form Demo & Documentation</title>
        <meta name="description" content="Demo and documentation for embedding the senior living appointment request form" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Appointment Form Demo
          </h1>
          <nav>
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              Back to Home
            </Link>
          </nav>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tabs for different communities */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {DEMO_COMMUNITIES.map(community => (
                <button
                  key={community.id}
                  onClick={() => handleCommunityChange(community.id)}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    selectedCommunity.id === community.id
                      ? `border-${community.id === 'custom' ? 'purple' : 'blue'}-500 text-${community.id === 'custom' ? 'purple' : 'blue'}-600`
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  style={{ 
                    borderBottomColor: selectedCommunity.id === community.id ? community.color : 'transparent',
                    color: selectedCommunity.id === community.id ? community.color : undefined
                  }}
                >
                  {community.name}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content area */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left column: Form preview */}
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Preview for {selectedCommunity.name}
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                  (Iframe auto-resizes; wizard slides use smooth CSS ease-in transitions)
                </p>
                <p className="text-gray-600 mb-6">
                  {selectedCommunity.description}
                </p>
                
                {/* Custom configuration form */}
                {selectedCommunity.id === 'custom' && (
                  <div className="bg-gray-50 p-4 rounded-md mb-6">
                    <h3 className="text-lg font-medium mb-3">Custom Configuration</h3>
                    <form onSubmit={applyCustomConfig} className="space-y-4">
                      <div>
                        <label htmlFor="communityName" className="block text-sm font-medium text-gray-700">
                          Community Name
                        </label>
                        <input
                          type="text"
                          id="communityName"
                          name="communityName"
                          value={customConfig.communityName}
                          onChange={handleCustomConfigChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700">
                          Primary Color
                        </label>
                        <div className="mt-1 flex items-center">
                          <input
                            type="color"
                            id="primaryColor"
                            name="primaryColor"
                            value={customConfig.primaryColor}
                            onChange={handleCustomConfigChange}
                            className="h-8 w-8 rounded-md border border-gray-300 mr-2"
                          />
                          <input
                            type="text"
                            name="primaryColor"
                            value={customConfig.primaryColor}
                            onChange={handleCustomConfigChange}
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="buttonText" className="block text-sm font-medium text-gray-700">
                          Button Text
                        </label>
                        <input
                          type="text"
                          id="buttonText"
                          name="buttonText"
                          value={customConfig.buttonText}
                          onChange={handleCustomConfigChange}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      
                      <div>
                        <button
                          type="submit"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        >
                          Apply Configuration
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                
                {/* Iframe container */}
                <div 
                  ref={iframeContainerRef}
                  className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden"
                  style={{ minHeight: '500px' }}
                >
                  {/* Iframe will be inserted here by JavaScript */}
                </div>
              </div>
              
              {/* Right column: Code snippets and documentation */}
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Embedding Instructions
                </h2>
                
                <div className="space-y-6">
                  {/* Basic embed code */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">Basic Embed Code</h3>
                    <p className="text-gray-600 mb-3">
                      Add this code to any HTML page to embed the appointment form:
                    </p>
                    <div className="bg-gray-800 rounded-md overflow-hidden">
                      <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
                        {generateEmbedCode(selectedCommunity)}
                      </pre>
                    </div>
                  </div>
                  
                  {/* JavaScript API */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">JavaScript API</h3>
                    <p className="text-gray-600 mb-3">
                      For more advanced usage, you can use the JavaScript API:
                    </p>
                    <div className="bg-gray-800 rounded-md overflow-hidden">
                      <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
                        {generateJsApiCode(selectedCommunity)}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Configuration options */}
                  <div>
                    <h3 className="text-lg font-medium mb-2">Available Configuration Options</h3>
                    <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Attribute
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Required
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-community
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              The name of the community
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              Yes
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-color
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              Primary color for buttons and accents (hex code)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-logo
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              URL to the community logo image
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-target
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              CSS selector for the container element
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-button-text
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              Custom text for the submit button
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-height
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              Height of the iframe (default: auto)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              data-width
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              Width of the iframe (default: 100%)
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              No
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Implementation tips */}
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Implementation Tips</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Multiple Communities</h3>
                <p className="text-gray-600">
                  You can embed the form multiple times on the same page with different community names. 
                  Each instance will be isolated and submit to the appropriate community.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Responsive Design</h3>
                <p className="text-gray-600">
                  The form automatically adjusts to fit its container. For the best experience, 
                  place it in a container that's at least 320px wide.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Event Handling</h3>
                <p className="text-gray-600">
                  You can listen for form submission events by defining callback functions in the global 
                  AppointmentFormConfig object or by listening for 'message' events from the iframe.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Security</h3>
                <p className="text-gray-600">
                  All API keys and sensitive credentials are kept on the server side. The embed script 
                  only passes the community name and styling options to the server.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Senior Living Appointment Form. All rights reserved.
          </p>
        </div>
      </footer>
      
      {/* Initialize the first community iframe on mount */}
      {typeof window !== 'undefined' && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize the first community iframe
              document.addEventListener('DOMContentLoaded', function() {
                const container = document.getElementById('iframe-container');
                if (container) {
                  ${renderIframe.toString()}
                  renderIframe(${JSON.stringify(DEMO_COMMUNITIES[0])});
                }
              });
            `
          }}
        />
      )}
    </div>
  );
}
