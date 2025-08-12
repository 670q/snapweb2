export const en = {
  // Header
  header: {
    title: 'snapweb',
  },

  // Navigation
  nav: {
    files: 'Files',
    search: 'Search',
    terminal: 'Terminal',
    preview: 'Preview',
  },

  // Buttons
  buttons: {
    newChat: 'New Chat',
    send: 'Send',
    clear: 'Clear',
    export: 'Export',
    deploy: 'Deploy',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    copy: 'Copy',
    paste: 'Paste',
    cut: 'Cut',
    undo: 'Undo',
    redo: 'Redo',
    refresh: 'Refresh',
    close: 'Close',
    open: 'Open',
    new: 'New',
    upload: 'Upload',
    download: 'Download Code',
    settings: 'Settings',
    help: 'Help',
    about: 'About',
  },

  // Chat
  chat: {
    placeholder: 'How can I help you today?',
    send: 'Send',
    clear: 'Clear Chat',
    export: 'Export Chat',
    import: 'Import Chat',
    goToLastMessage: 'Go to last message',
    newChat: 'New Chat',
    chatHistory: 'Chat History',
    noMessages: 'No messages yet',
    thinking: 'Thinking...',
    typing: 'Typing...',
    generating: 'Generating...',
    error: 'Something went wrong. Please try again.',
    retry: 'Retry',
    stop: 'Stop',
  },

  // File operations
  files: {
    newFile: 'New File',
    newFolder: 'New Folder',
    rename: 'Rename',
    delete: 'Delete',
    copy: 'Copy',
    cut: 'Cut',
    paste: 'Paste',
    upload: 'Upload Files',
    download: 'Download',
    noFiles: 'No files found',
    fileName: 'File Name',
    folderName: 'Folder Name',
  },

  // Deploy
  deploy: {
    title: 'Deploy Project',
    deploying: 'Deploying to',
    deployToNetlify: 'Deploy to Netlify',
    deployToVercel: 'Deploy to Vercel',
    deployToCloudflare: 'Deploy to Cloudflare (Coming Soon)',
    noNetlifyAccount: 'No Netlify Account Connected',
    noVercelAccount: 'No Vercel Account Connected',
    success: 'Deployed successfully!',
    error: 'Deployment failed',
    selectPlatform: 'Select Platform',
    vercel: 'Vercel',
    netlify: 'Netlify',
    github: 'GitHub Pages',
  },

  // Settings
  settings: {
    title: 'Settings',
    general: 'General',
    appearance: 'Appearance',
    language: 'Language',
    theme: 'Theme',
    providers: 'Providers',
    connections: 'Connections',
    data: 'Data',
    about: 'About',
    save: 'Save Settings',
    reset: 'Reset to Default',
    preferences: 'Preferences',
    notifications: 'Notifications',
    notificationsEnabled: 'Notifications are enabled',
    notificationsDisabled: 'Notifications are disabled',
    timeSettings: 'Time Settings',
    timezone: 'Timezone',
    keyboardShortcuts: 'Keyboard Shortcuts',
    toggleTheme: 'Toggle Theme',
    toggleThemeDescription: 'Switch between light and dark mode',
    updated: 'Settings updated',
    updateFailed: 'Failed to update settings',
  },

  // Theme
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },

  // Language
  language: {
    english: 'English',
    arabic: 'العربية',
    selectLanguage: 'Select Language',
  },

  // Messages
  messages: {
    welcome: 'Welcome to snapweb!',
    success: 'Operation completed successfully',
    error: 'An error occurred',
    warning: 'Warning',
    info: 'Information',
    loading: 'Loading...',
    saving: 'Saving...',
    deleting: 'Deleting...',
    copying: 'Copying...',
    uploading: 'Uploading...',
    downloading: 'Downloading...',
    saved: 'Saved successfully',
    deleted: 'Deleted successfully',
    copied: 'Copied to clipboard',
    updated: 'Updated successfully',
  },

  // Intro
  intro: {
    title: 'Where ideas begin',
    subtitle: 'Bring your ideas to life in seconds or get help with your current projects.',
  },

  // Errors
  errors: {
    fileNotFound: 'File not found',
    networkError: 'Network error',
    permissionDenied: 'Permission denied',
    invalidInput: 'Invalid input',
    serverError: 'Server error',
    unknownError: 'Unknown error occurred',
  },

  // Common
  common: {
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    finish: 'Finish',
    skip: 'Skip',
    retry: 'Retry',
    continue: 'Continue',
  },
};

export type TranslationKeys = typeof en;
