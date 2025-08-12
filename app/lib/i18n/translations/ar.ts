import type { TranslationKeys } from './en';

export const ar: TranslationKeys = {
  // Header
  header: {
    title: 'سناب ويب',
  },

  // Navigation
  nav: {
    files: 'الملفات',
    search: 'البحث',
    terminal: 'الطرفية',
    preview: 'المعاينة',
  },

  // Buttons
  buttons: {
    newChat: 'محادثة جديدة',
    send: 'إرسال',
    clear: 'مسح',
    export: 'تصدير',
    deploy: 'نشر',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    copy: 'نسخ',
    paste: 'لصق',
    cut: 'قص',
    undo: 'تراجع',
    redo: 'إعادة',
    refresh: 'تحديث',
    close: 'إغلاق',
    open: 'فتح',
    new: 'جديد',
    upload: 'رفع',
    download: 'تحميل الكود',
    settings: 'الإعدادات',
    help: 'المساعدة',
    about: 'حول',
  },

  // Chat
  chat: {
    placeholder: 'كيف يمكنني مساعدتك اليوم؟',
    send: 'إرسال',
    clear: 'مسح المحادثة',
    export: 'تصدير المحادثة',
    import: 'استيراد المحادثة',
    goToLastMessage: 'الذهاب إلى آخر رسالة',
    newChat: 'محادثة جديدة',
    chatHistory: 'تاريخ المحادثات',
    noMessages: 'لا توجد رسائل بعد',
    thinking: 'أفكر...',
    typing: 'أكتب...',
    generating: 'ينشئ...',
    error: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    retry: 'إعادة المحاولة',
    stop: 'توقف',
  },

  // File operations
  files: {
    newFile: 'ملف جديد',
    newFolder: 'مجلد جديد',
    rename: 'إعادة تسمية',
    delete: 'حذف',
    copy: 'نسخ',
    cut: 'قص',
    paste: 'لصق',
    upload: 'رفع الملفات',
    download: 'تحميل',
    noFiles: 'لم يتم العثور على ملفات',
    fileName: 'اسم الملف',
    folderName: 'اسم المجلد',
  },

  // Deploy
  deploy: {
    title: 'نشر المشروع',
    deploying: 'جاري النشر إلى',
    deployToNetlify: 'نشر إلى Netlify',
    deployToVercel: 'نشر إلى Vercel',
    deployToCloudflare: 'نشر إلى Cloudflare (قريباً)',
    noNetlifyAccount: 'لا يوجد حساب Netlify متصل',
    noVercelAccount: 'لا يوجد حساب Vercel متصل',
    success: 'تم النشر بنجاح!',
    error: 'فشل في النشر',
    selectPlatform: 'اختر المنصة',
    vercel: 'فيرسل',
    netlify: 'نتليفاي',
    github: 'صفحات جيت هاب',
  },

  // Settings
  settings: {
    title: 'الإعدادات',
    general: 'عام',
    appearance: 'المظهر',
    language: 'اللغة',
    theme: 'السمة',
    providers: 'مقدمو الخدمة',
    connections: 'الاتصالات',
    data: 'البيانات',
    about: 'حول',
    save: 'حفظ الإعدادات',
    reset: 'إعادة تعيين افتراضي',
    preferences: 'التفضيلات',
    notifications: 'الإشعارات',
    notificationsEnabled: 'الإشعارات مفعلة',
    notificationsDisabled: 'الإشعارات معطلة',
    timeSettings: 'إعدادات الوقت',
    timezone: 'المنطقة الزمنية',
    keyboardShortcuts: 'اختصارات لوحة المفاتيح',
    toggleTheme: 'تبديل السمة',
    toggleThemeDescription: 'التبديل بين الوضع الفاتح والداكن',
    updated: 'تم تحديث الإعدادات',
    updateFailed: 'فشل في تحديث الإعدادات',
  },

  // Theme
  theme: {
    light: 'فاتح',
    dark: 'داكن',
    system: 'النظام',
  },

  // Language
  language: {
    english: 'English',
    arabic: 'العربية',
    selectLanguage: 'اختر اللغة',
  },

  // Messages
  messages: {
    welcome: 'مرحباً بك في snapweb!',
    success: 'تمت العملية بنجاح',
    error: 'حدث خطأ',
    warning: 'تحذير',
    info: 'معلومات',
    loading: 'جاري التحميل...',
    saving: 'جاري الحفظ...',
    deleting: 'جاري الحذف...',
    copying: 'جاري النسخ...',
    uploading: 'جاري الرفع...',
    downloading: 'جاري التحميل...',
    saved: 'تم الحفظ بنجاح',
    deleted: 'تم الحذف بنجاح',
    copied: 'تم النسخ إلى الحافظة',
    updated: 'تم التحديث بنجاح',
  },

  intro: {
    title: 'حيث تبدأ الأفكار',
    subtitle: 'حوّل أفكارك إلى واقع في ثوانٍ أو احصل على المساعدة في مشاريعك الحالية.',
  },

  // Errors
  errors: {
    fileNotFound: 'الملف غير موجود',
    networkError: 'خطأ في الشبكة',
    permissionDenied: 'تم رفض الإذن',
    invalidInput: 'إدخال غير صحيح',
    serverError: 'خطأ في الخادم',
    unknownError: 'حدث خطأ غير معروف',
  },

  // Common
  common: {
    yes: 'نعم',
    no: 'لا',
    ok: 'موافق',
    confirm: 'تأكيد',
    back: 'رجوع',
    next: 'التالي',
    previous: 'السابق',
    finish: 'إنهاء',
    skip: 'تخطي',
    retry: 'إعادة المحاولة',
    continue: 'متابعة',
  },
};
