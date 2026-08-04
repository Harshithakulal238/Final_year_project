import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "kn";

const STORAGE_KEY = "sahayak.lang";

const en = {
  // common
  "common.appName": "Sahayak",
  "common.cancel": "Cancel",
  "common.or": "OR",
  "common.years": "{n} years",

  // header / footer
  "header.home": "Home",
  "header.mySchemes": "My schemes",
  "header.accountMenuAria": "Account menu",
  "header.guestSession": "Guest session",
  "header.dashboard": "Dashboard",
  "header.viewProfile": "View profile",
  "header.editProfile": "Edit profile",
  "header.logout": "Logout",
  "header.signIn": "Sign in",
  "header.mobilePrefix": "+91 {mobile}",
  "header.logoutConfirmTitle": "Do you really want to log out?",
  "header.logoutConfirmDesc":
    "Your saved profile and bookmarks on this device will be cleared. You can sign in again with OTP or continue as guest.",
  "header.logoutCancel": "Cancel",
  "header.logoutConfirm": "Yes, log out",
  "header.loggedOutToast": "Logged out",
  "header.langToggleAria": "Switch language",
  "footer.rights": "© {year} Sahayak",
  "footer.disclaimer": "Not affiliated with any government body",

  // landing
  "landing.badge": "AI-powered eligibility matching",
  "landing.heroTitle": "Every scheme you qualify for.",
  "landing.heroTitleHighlight": "One profile away.",
  "landing.heroSubtitle":
    "Sahayak checks state government schemes against your profile and ranks them by fit — with clear reasons in plain language.",
  "landing.ctaFind": "Find Schemes for You",
  "landing.ctaSignIn": "Sign in",
  "landing.freeNote": "Free · No data leaves your device · Takes ~2 minutes",
  "landing.feature1Title": "Eligibility engine",
  "landing.feature1Body":
    "Every scheme is checked against age, income, caste, occupation and target group.",
  "landing.feature2Title": "AI ranking",
  "landing.feature2Body":
    "Weighted scoring surfaces the schemes that fit you best — not just a long list.",
  "landing.feature3Title": "Confidence score",
  "landing.feature3Body": "OTP verification and document uploads improve match confidence to High.",
  "landing.stepsTitle": "Your path to the right scheme",
  "landing.stepsSubtitle": "Four simple steps from profile to application.",
  "landing.step1Title": "Sign in",
  "landing.step1Body": "Verify with mobile OTP or continue as guest.",
  "landing.step2Title": "Tell us about you",
  "landing.step2Body": "Age, income, ration card, caste, occupation, status.",
  "landing.step3Title": "We match",
  "landing.step3Body": "Eligibility engine + AI ranking + plain-language reasons.",
  "landing.step4Title": "Apply",
  "landing.step4Body": "Open the official portal directly from your top schemes.",

  // not found / error
  "notFound.code": "404",
  "notFound.heading": "Page not found",
  "notFound.desc": "The page you're looking for doesn't exist or has been moved.",
  "notFound.goHome": "Go home",
  "errorPage.heading": "This page didn't load",
  "errorPage.desc": "Something went wrong on our end. You can try refreshing or head back home.",
  "errorPage.tryAgain": "Try again",
  "errorPage.goHome": "Go home",

  // login
  "login.titleLogin": "Log In",
  "login.titleRegister": "Create an Account",
  "login.subtitleLogin": "Sign in with your username and password.",
  "login.subtitleRegister": "Register with username, password and mobile OTP verification.",
  "login.username": "Username",
  "login.usernamePlaceholderLogin": "Enter your username",
  "login.usernamePlaceholderRegister": "Pick a username",
  "login.password": "Password",
  "login.passwordPlaceholderLogin": "Enter your password",
  "login.passwordPlaceholderRegister": "Choose a password",
  "login.loginBtn": "Log In",
  "login.mobileLabel": "Indian mobile number",
  "login.mobilePlaceholder": "10-digit number",
  "login.sendOtp": "Send OTP",
  "login.otpLabel": "Enter OTP sent to +91 {mobile}",
  "login.otpDemoNote": "Demo: use the code shown in the toast.",
  "login.resendOtp": "Resend OTP",
  "login.back": "Back",
  "login.verifyOtp": "Verify OTP",
  "login.continueGuest": "Continue as guest",
  "login.guestNote": "Guest confidence will be lower — you can verify anytime.",
  "login.alreadyHaveAccount": "Already have an account?",
  "login.newToSahayak": "New to Sahayak?",
  "login.createAccount": "Create an account",
  "login.errInvalidCredentials": "Invalid username or password",
  "login.errEnterUserPass": "Enter username and password",
  "login.errUsernameTaken": "Username is already taken",
  "login.errInvalidMobile": "Enter a valid 10-digit Indian mobile number",
  "login.errIncorrectOtp": "Incorrect OTP",
  "login.demoOtpToastTitle": "Demo OTP: {code}",
  "login.demoOtpToastDesc": "Sent to +91 {mobile}. Use this code to verify.",
  "login.accountCreatedToast": "Account created.",

  // dashboard
  "dashboard.verifiedBadge": "Verified · +91 {mobile}",
  "dashboard.guestBadge": "Guest session",
  "dashboard.welcomeBackPrefix": "Welcome back,",
  "dashboard.matchCount": "{count} government scheme{suffix} match your profile right now.",
  "dashboard.completeProfilePrompt":
    "Complete your profile to unlock personalised scheme recommendations.",
  "dashboard.statEligibleSchemes": "Eligible schemes",
  "dashboard.statTopMatchScore": "Top match score",
  "dashboard.statConfidence": "Confidence",
  "dashboard.quickActions": "Quick actions",
  "dashboard.findSchemesTitle": "Find schemes",
  "dashboard.findSchemesBody":
    "AI-ranked schemes based on your profile — with plain-language reasons.",
  "dashboard.findSchemesCta": "Discover",
  "dashboard.mySchemesTitle": "My schemes",
  "dashboard.mySchemesBody": "Bookmarks, eligible list and rejection reasons — all in one place.",
  "dashboard.mySchemesCta": "Open",
  "dashboard.profileTitle": "Profile",
  "dashboard.profileBodyComplete": "Update details — matches refresh automatically.",
  "dashboard.profileBodyIncomplete": "Complete required details to see matches.",
  "dashboard.profileCtaManage": "Manage",
  "dashboard.profileCtaComplete": "Complete now",
  "dashboard.topPickBadge": "Top pick for you",
  "dashboard.why": "Why: ",
  "dashboard.matchScoreLabel": "Match score {score}/100",
  "dashboard.viewDetails": "View details",
  "dashboard.profileSnapshot": "Profile snapshot",
  "dashboard.name": "Name",
  "dashboard.age": "Age",
  "dashboard.occupation": "Occupation",
  "dashboard.rationCard": "Ration card",
  "dashboard.location": "Location",
  "dashboard.editProfile": "Edit profile",

  // profile
  "profile.title": "Your profile",
  "profile.viewSubtitle":
    "Review your information. Update it anytime — recommendations refresh automatically.",
  "profile.requiredNote": "Fields marked with * are required. Your answers stay on your device.",
  "profile.guestSessionPrefix": "Guest session ·",
  "profile.verifyToBoost": "verify to boost confidence",
  "profile.verifiedMobile": "Mobile verified · +91 {mobile}",
  "profile.editProfileBtn": "Edit profile",
  "profile.viewSchemesBtn": "View schemes",
  "profile.sectionBasicDetails": "Basic details",
  "profile.sectionEconomicStatus": "Economic status",
  "profile.sectionCategoryOccupation": "Category & occupation",
  "profile.sectionLocation": "Location",
  "profile.sectionSpecialConditions": "Special conditions",
  "profile.specialConditionsHint": "Optional — select any that apply",
  "profile.rowFullName": "Full name",
  "profile.rowDob": "Date of birth",
  "profile.rowGender": "Gender",
  "profile.rowMobile": "Mobile",
  "profile.rowIncome": "Annual family income",
  "profile.rowRationCard": "Ration card",
  "profile.rowCategory": "Category",
  "profile.rowMinorityType": "Minority type",
  "profile.rowOccupation": "Occupation",
  "profile.rowState": "State",
  "profile.rowDistrict": "District",
  "profile.rowTaluk": "Taluk",
  "profile.rowVillage": "Village / City",
  "profile.rowPincode": "PIN code",
  "profile.rowSpecialApplies": "Applies",
  "profile.fieldFullNamePlaceholder": "e.g. Priya Sharma",
  "profile.fieldGenderLabel": "Gender",
  "profile.fieldMobileLabel": "Mobile number",
  "profile.fieldMobilePlaceholder": "10-digit number",
  "profile.fieldIncomeLabel": "Annual family income (₹)",
  "profile.fieldRationCardLabel": "Ration card type",
  "profile.rationCardPlaceholder": "Select ration card",
  "profile.rationApl": "APL (Above Poverty Line)",
  "profile.rationBpl": "BPL (Below Poverty Line)",
  "profile.rationAay": "AAY (Antyodaya Anna Yojana)",
  "profile.rationNone": "No ration card",
  "profile.fieldCasteCategoryLabel": "Caste category",
  "profile.fieldOccupationLabel": "Occupation",
  "profile.occupationPlaceholder": "Select occupation",
  "profile.fieldMinorityTypeLabel": "Minority type",
  "profile.minorityTypePlaceholder": "Select minority community",
  "profile.fieldStateLabel": "State",
  "profile.fieldStateDefaultNote": "Default: Karnataka",
  "profile.fieldDistrictLabel": "District",
  "profile.districtPlaceholder": "Search district",
  "profile.fieldTalukLabel": "Taluk",
  "profile.talukPlaceholder": "Search taluk",
  "profile.talukPlaceholderDisabled": "Choose district first",
  "profile.fieldVillageLabel": "Village / City",
  "profile.villagePlaceholder": "Search or type your village/city",
  "profile.villagePlaceholderDisabled": "Choose district first",
  "profile.fieldPincodeLabel": "PIN code",
  "profile.pincodePlaceholder": "6-digit",
  "profile.ageLabel": "Age: {age} years",
  "profile.conditionPregnant": "Pregnant / lactating",
  "profile.conditionWidow": "Widow",
  "profile.conditionDisabled": "Person with disability",
  "profile.crossFieldWarnings": "Cross-field validation warnings",
  "profile.cancel": "Cancel",
  "profile.saveAndFind": "Save & find schemes →",
  "profile.errName": "Please enter your name",
  "profile.errDobRequired": "Please select your date of birth",
  "profile.errDobInvalid": "Enter a valid date of birth",
  "profile.errMobile": "Enter a valid 10-digit mobile number",
  "profile.errIncome": "Enter a valid annual income",
  "profile.errOccupation": "Select an occupation",
  "profile.errRationCard": "Select your ration card type",
  "profile.errMinorityType": "Select your minority type",
  "profile.errDistrict": "Enter your district",
  "profile.errTaluk": "Enter your taluk",
  "profile.errVillage": "Enter your village/city",
  "profile.errPincode": "Enter a valid 6-digit PIN code",
  "profile.toastFixFields": "Please fix the highlighted fields",
  "profile.toastUpdated": "Profile updated successfully.",
  "profile.genderFemale": "Female",
  "profile.genderMale": "Male",
  "profile.genderOther": "Other",
  "profile.casteGeneral": "General",
  "profile.casteOBC": "OBC",
  "profile.casteSC": "SC",
  "profile.casteST": "ST",
  "profile.casteMinority": "Minority",
  "profile.minorityMuslim": "Muslim",
  "profile.minorityChristian": "Christian",
  "profile.minoritySikh": "Sikh",
  "profile.minorityJain": "Jain",
  "profile.minorityBuddhist": "Buddhist",
  "profile.minorityParsi": "Parsi",
  "profile.minorityOther": "Other",

  // results
  "results.matchTitle": "{count} schemes match your profile",
  "results.rankedFor": "Ranked by fit for {name} · {eligible} eligible · {ineligible} not eligible",
  "results.editProfileRecalc": "Edit profile & recalculate",
  "results.confidence": "Confidence",
  "results.eligibleSchemes": "Eligible schemes",
  "results.topMatchScore": "Top match score",
  "results.filterTop": "Top picks",
  "results.filterEligible": "Eligible",
  "results.filterIneligible": "Ineligible",
  "results.filterBookmarks": "Bookmarks",
  "results.searchPlaceholder": "Search schemes",
  "results.allCategories": "All categories",
  "results.noSchemes": "No schemes to show for these filters.",
  "results.why": "Why: ",
  "results.eligibleBadge": "Eligible",
  "results.notEligibleBadge": "Not eligible",
  "results.matchScore": "Match score",
  "results.viewDetails": "View details",
  "results.tellUsFirstTitle": "Tell us about you first",
  "results.tellUsFirstDesc": "Complete your profile so we can match you with schemes.",
  "results.fillProfileCta": "Fill profile →",

  // scheme detail
  "scheme.backToResults": "Back to results",
  "scheme.bookmarked": "Bookmarked",
  "scheme.bookmark": "Bookmark",
  "scheme.eligibleTitle": "You appear eligible",
  "scheme.notEligibleTitle": "You may not be eligible",
  "scheme.matchScoreLine": "Match score: {score}/100 · {explanation}",
  "scheme.keyBenefits": "Key benefits",
  "scheme.requiredDocuments": "Required documents",
  "scheme.whyMatches": "Why this matches you",
  "scheme.noCriteriaMatched": "No specific criteria matched.",
  "scheme.gapsToAddress": "Gaps to address",
  "scheme.meetAllCriteria": "You meet all criteria.",
  "scheme.readyToApply": "Ready to apply?",
  "scheme.redirectNote": "You'll be redirected to the official government portal.",
  "scheme.allSchemes": "All schemes",
  "scheme.applyNow": "Apply now",

  // chatbot
  "chatbot.greeting":
    "Hi! I'm Sahayak Assistant. Ask me about government schemes, eligibility, documents, or how to use this app.",
  "chatbot.openAria": "Open Sahayak assistant",
  "chatbot.title": "Sahayak Assistant",
  "chatbot.subtitle": "Ask about schemes & eligibility",
  "chatbot.closeAria": "Close chat",
  "chatbot.thinking": "Thinking…",
  "chatbot.placeholder": "Ask about a scheme, eligibility…",
  "chatbot.errRateLimited":
    "I'm getting too many requests right now. Please try again in a moment.",
  "chatbot.errNoCredits": "The AI service is out of credits. Please contact the app owner.",
  "chatbot.errGeneric": "Sorry, I couldn't reach the assistant. Please try again.",
  "chatbot.errNoReply": "I'm not sure about that — please check the official scheme details page.",
  "chatbot.errNetwork": "Network error. Please try again.",
} as const;

const kn: Record<keyof typeof en, string> = {
  // common
  "common.appName": "ಸಹಾಯಕ್",
  "common.cancel": "ರದ್ದುಮಾಡಿ",
  "common.or": "ಅಥವಾ",
  "common.years": "{n} ವರ್ಷಗಳು",

  // header / footer
  "header.home": "ಮುಖಪುಟ",
  "header.mySchemes": "ನನ್ನ ಯೋಜನೆಗಳು",
  "header.accountMenuAria": "ಖಾತೆ ಮೆನು",
  "header.guestSession": "ಅತಿಥಿ ಅವಧಿ",
  "header.dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
  "header.viewProfile": "ಪ್ರೊಫೈಲ್ ವೀಕ್ಷಿಸಿ",
  "header.editProfile": "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",
  "header.logout": "ಲಾಗ್ಔಟ್",
  "header.signIn": "ಸೈನ್ ಇನ್",
  "header.mobilePrefix": "+91 {mobile}",
  "header.logoutConfirmTitle": "ನೀವು ನಿಜವಾಗಿಯೂ ಲಾಗ್ಔಟ್ ಮಾಡಲು ಬಯಸುವಿರಾ?",
  "header.logoutConfirmDesc":
    "ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಿದ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಬುಕ್‌ಮಾರ್ಕ್‌ಗಳು ಅಳಿಸಲ್ಪಡುತ್ತವೆ. ನೀವು OTP ಮೂಲಕ ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಬಹುದು ಅಥವಾ ಅತಿಥಿಯಾಗಿ ಮುಂದುವರಿಯಬಹುದು.",
  "header.logoutCancel": "ರದ್ದುಮಾಡಿ",
  "header.logoutConfirm": "ಹೌದು, ಲಾಗ್ಔಟ್ ಮಾಡಿ",
  "header.loggedOutToast": "ಲಾಗ್ಔಟ್ ಆಗಿದೆ",
  "header.langToggleAria": "ಭಾಷೆ ಬದಲಾಯಿಸಿ",
  "footer.rights": "© {year} ಸಹಾಯಕ್",
  "footer.disclaimer": "ಯಾವುದೇ ಸರ್ಕಾರಿ ಸಂಸ್ಥೆಯೊಂದಿಗೆ ಸಂಬಂಧ ಹೊಂದಿಲ್ಲ",

  // landing
  "landing.badge": "AI ಆಧಾರಿತ ಅರ್ಹತಾ ಹೊಂದಾಣಿಕೆ",
  "landing.heroTitle": "ನೀವು ಅರ್ಹರಾಗಿರುವ ಪ್ರತಿಯೊಂದು ಯೋಜನೆ.",
  "landing.heroTitleHighlight": "ಒಂದೇ ಪ್ರೊಫೈಲ್ ದೂರದಲ್ಲಿ.",
  "landing.heroSubtitle":
    "ಸಹಾಯಕ್ ರಾಜ್ಯ ಸರ್ಕಾರದ ಯೋಜನೆಗಳನ್ನು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ಗೆ ಹೋಲಿಸಿ ಪರಿಶೀಲಿಸಿ, ಸ್ಪಷ್ಟ ಕಾರಣಗಳೊಂದಿಗೆ ಸರಳ ಭಾಷೆಯಲ್ಲಿ ಅವುಗಳನ್ನು ಶ್ರೇಣೀಕರಿಸುತ್ತದೆ.",
  "landing.ctaFind": "ನಿಮಗಾಗಿ ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ",
  "landing.ctaSignIn": "ಸೈನ್ ಇನ್",
  "landing.freeNote":
    "ಉಚಿತ · ನಿಮ್ಮ ಡೇಟಾ ಸಾಧನದಿಂದ ಹೊರಹೋಗುವುದಿಲ್ಲ · ಸುಮಾರು 2 ನಿಮಿಷ ತೆಗೆದುಕೊಳ್ಳುತ್ತದೆ",
  "landing.feature1Title": "ಅರ್ಹತಾ ಎಂಜಿನ್",
  "landing.feature1Body":
    "ಪ್ರತಿ ಯೋಜನೆಯನ್ನು ವಯಸ್ಸು, ಆದಾಯ, ಜಾತಿ, ಉದ್ಯೋಗ ಮತ್ತು ಗುರಿ ಗುಂಪಿನ ಆಧಾರದ ಮೇಲೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ.",
  "landing.feature2Title": "AI ಶ್ರೇಣೀಕರಣ",
  "landing.feature2Body":
    "ತೂಕದ ಸ್ಕೋರಿಂಗ್ ನಿಮಗೆ ಹೆಚ್ಚು ಸೂಕ್ತವಾದ ಯೋಜನೆಗಳನ್ನು ತೋರಿಸುತ್ತದೆ — ಕೇವಲ ದೊಡ್ಡ ಪಟ್ಟಿಯಲ್ಲ.",
  "landing.feature3Title": "ವಿಶ್ವಾಸಾರ್ಹತಾ ಸ್ಕೋರ್",
  "landing.feature3Body":
    "OTP ಪರಿಶೀಲನೆ ಮತ್ತು ದಾಖಲೆ ಅಪ್‌ಲೋಡ್‌ಗಳು ಹೊಂದಾಣಿಕೆ ವಿಶ್ವಾಸಾರ್ಹತೆಯನ್ನು ಹೆಚ್ಚಿಗೆ ಸುಧಾರಿಸುತ್ತವೆ.",
  "landing.stepsTitle": "ಸರಿಯಾದ ಯೋಜನೆಗೆ ನಿಮ್ಮ ದಾರಿ",
  "landing.stepsSubtitle": "ಪ್ರೊಫೈಲ್‌ನಿಂದ ಅರ್ಜಿಯವರೆಗೆ ನಾಲ್ಕು ಸರಳ ಹಂತಗಳು.",
  "landing.step1Title": "ಸೈನ್ ಇನ್ ಮಾಡಿ",
  "landing.step1Body": "ಮೊಬೈಲ್ OTP ಮೂಲಕ ಪರಿಶೀಲಿಸಿ ಅಥವಾ ಅತಿಥಿಯಾಗಿ ಮುಂದುವರಿಯಿರಿ.",
  "landing.step2Title": "ನಿಮ್ಮ ಬಗ್ಗೆ ತಿಳಿಸಿ",
  "landing.step2Body": "ವಯಸ್ಸು, ಆದಾಯ, ರೇಷನ್ ಕಾರ್ಡ್, ಜಾತಿ, ಉದ್ಯೋಗ, ಸ್ಥಿತಿ.",
  "landing.step3Title": "ನಾವು ಹೊಂದಿಸುತ್ತೇವೆ",
  "landing.step3Body": "ಅರ್ಹತಾ ಎಂಜಿನ್ + AI ಶ್ರೇಣೀಕರಣ + ಸರಳ ಭಾಷೆಯ ಕಾರಣಗಳು.",
  "landing.step4Title": "ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",
  "landing.step4Body": "ನಿಮ್ಮ ಉನ್ನತ ಯೋಜನೆಗಳಿಂದ ನೇರವಾಗಿ ಅಧಿಕೃತ ಪೋರ್ಟಲ್ ತೆರೆಯಿರಿ.",

  // not found / error
  "notFound.code": "404",
  "notFound.heading": "ಪುಟ ಸಿಗಲಿಲ್ಲ",
  "notFound.desc": "ನೀವು ಹುಡುಕುತ್ತಿರುವ ಪುಟ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ ಅಥವಾ ಸ್ಥಳಾಂತರಗೊಂಡಿದೆ.",
  "notFound.goHome": "ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ",
  "errorPage.heading": "ಈ ಪುಟ ಲೋಡ್ ಆಗಲಿಲ್ಲ",
  "errorPage.desc":
    "ನಮ್ಮ ಕಡೆಯಿಂದ ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಪುನಃ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ.",
  "errorPage.tryAgain": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  "errorPage.goHome": "ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ",

  // login
  "login.titleLogin": "ಲಾಗ್ ಇನ್",
  "login.titleRegister": "ಖಾತೆ ರಚಿಸಿ",
  "login.subtitleLogin": "ನಿಮ್ಮ ಬಳಕೆದಾರಹೆಸರು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್‌ನೊಂದಿಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.",
  "login.subtitleRegister": "ಬಳಕೆದಾರಹೆಸರು, ಪಾಸ್‌ವರ್ಡ್ ಮತ್ತು ಮೊಬೈಲ್ OTP ಪರಿಶೀಲನೆಯೊಂದಿಗೆ ನೋಂದಾಯಿಸಿ.",
  "login.username": "ಬಳಕೆದಾರಹೆಸರು",
  "login.usernamePlaceholderLogin": "ನಿಮ್ಮ ಬಳಕೆದಾರಹೆಸರನ್ನು ನಮೂದಿಸಿ",
  "login.usernamePlaceholderRegister": "ಬಳಕೆದಾರಹೆಸರನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "login.password": "ಪಾಸ್‌ವರ್ಡ್",
  "login.passwordPlaceholderLogin": "ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
  "login.passwordPlaceholderRegister": "ಪಾಸ್‌ವರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ",
  "login.loginBtn": "ಲಾಗ್ ಇನ್",
  "login.mobileLabel": "ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
  "login.mobilePlaceholder": "10-ಅಂಕಿಯ ಸಂಖ್ಯೆ",
  "login.sendOtp": "OTP ಕಳುಹಿಸಿ",
  "login.otpLabel": "+91 {mobile} ಗೆ ಕಳುಹಿಸಿದ OTP ನಮೂದಿಸಿ",
  "login.otpDemoNote": "ಡೆಮೊ: ಟೋಸ್ಟ್‌ನಲ್ಲಿ ತೋರಿಸಿದ ಕೋಡ್ ಬಳಸಿ.",
  "login.resendOtp": "OTP ಮರುಕಳುಹಿಸಿ",
  "login.back": "ಹಿಂದೆ",
  "login.verifyOtp": "OTP ಪರಿಶೀಲಿಸಿ",
  "login.continueGuest": "ಅತಿಥಿಯಾಗಿ ಮುಂದುವರಿಯಿರಿ",
  "login.guestNote": "ಅತಿಥಿ ವಿಶ್ವಾಸಾರ್ಹತೆ ಕಡಿಮೆ ಇರುತ್ತದೆ — ನೀವು ಯಾವಾಗ ಬೇಕಾದರೂ ಪರಿಶೀಲಿಸಬಹುದು.",
  "login.alreadyHaveAccount": "ಈಗಾಗಲೇ ಖಾತೆ ಹೊಂದಿದ್ದೀರಾ?",
  "login.newToSahayak": "ಸಹಾಯಕ್‌ಗೆ ಹೊಸಬರೇ?",
  "login.createAccount": "ಖಾತೆ ರಚಿಸಿ",
  "login.errInvalidCredentials": "ಅಮಾನ್ಯ ಬಳಕೆದಾರಹೆಸರು ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್",
  "login.errEnterUserPass": "ಬಳಕೆದಾರಹೆಸರು ಮತ್ತು ಪಾಸ್‌ವರ್ಡ್ ನಮೂದಿಸಿ",
  "login.errUsernameTaken": "ಈ ಬಳಕೆದಾರಹೆಸರು ಈಗಾಗಲೇ ಬಳಕೆಯಲ್ಲಿದೆ",
  "login.errInvalidMobile": "ಮಾನ್ಯ 10-ಅಂಕಿಯ ಭಾರತೀಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ",
  "login.errIncorrectOtp": "ತಪ್ಪಾದ OTP",
  "login.demoOtpToastTitle": "ಡೆಮೊ OTP: {code}",
  "login.demoOtpToastDesc": "+91 {mobile} ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ. ಪರಿಶೀಲಿಸಲು ಈ ಕೋಡ್ ಬಳಸಿ.",
  "login.accountCreatedToast": "ಖಾತೆ ರಚಿಸಲಾಗಿದೆ.",

  // dashboard
  "dashboard.verifiedBadge": "ಪರಿಶೀಲಿಸಲಾಗಿದೆ · +91 {mobile}",
  "dashboard.guestBadge": "ಅತಿಥಿ ಅವಧಿ",
  "dashboard.welcomeBackPrefix": "ಮತ್ತೆ ಸ್ವಾಗತ,",
  "dashboard.matchCount": "{count} ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು ಈಗ ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ.",
  "dashboard.completeProfilePrompt":
    "ವೈಯಕ್ತಿಕಗೊಳಿಸಿದ ಯೋಜನಾ ಶಿಫಾರಸುಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ.",
  "dashboard.statEligibleSchemes": "ಅರ್ಹ ಯೋಜನೆಗಳು",
  "dashboard.statTopMatchScore": "ಉನ್ನತ ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್",
  "dashboard.statConfidence": "ವಿಶ್ವಾಸಾರ್ಹತೆ",
  "dashboard.quickActions": "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು",
  "dashboard.findSchemesTitle": "ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ",
  "dashboard.findSchemesBody":
    "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಆಧಾರಿತ AI-ಶ್ರೇಣೀಕೃತ ಯೋಜನೆಗಳು — ಸರಳ ಭಾಷೆಯ ಕಾರಣಗಳೊಂದಿಗೆ.",
  "dashboard.findSchemesCta": "ಅನ್ವೇಷಿಸಿ",
  "dashboard.mySchemesTitle": "ನನ್ನ ಯೋಜನೆಗಳು",
  "dashboard.mySchemesBody":
    "ಬುಕ್‌ಮಾರ್ಕ್‌ಗಳು, ಅರ್ಹ ಪಟ್ಟಿ ಮತ್ತು ತಿರಸ್ಕಾರ ಕಾರಣಗಳು — ಎಲ್ಲವೂ ಒಂದೇ ಕಡೆ.",
  "dashboard.mySchemesCta": "ತೆರೆಯಿರಿ",
  "dashboard.profileTitle": "ಪ್ರೊಫೈಲ್",
  "dashboard.profileBodyComplete":
    "ವಿವರಗಳನ್ನು ನವೀಕರಿಸಿ — ಹೊಂದಾಣಿಕೆಗಳು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪುನಶ್ಚೇತನಗೊಳ್ಳುತ್ತವೆ.",
  "dashboard.profileBodyIncomplete": "ಹೊಂದಾಣಿಕೆಗಳನ್ನು ನೋಡಲು ಅಗತ್ಯ ವಿವರಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.",
  "dashboard.profileCtaManage": "ನಿರ್ವಹಿಸಿ",
  "dashboard.profileCtaComplete": "ಈಗ ಪೂರ್ಣಗೊಳಿಸಿ",
  "dashboard.topPickBadge": "ನಿಮಗಾಗಿ ಉನ್ನತ ಆಯ್ಕೆ",
  "dashboard.why": "ಏಕೆ: ",
  "dashboard.matchScoreLabel": "ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್ {score}/100",
  "dashboard.viewDetails": "ವಿವರಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
  "dashboard.profileSnapshot": "ಪ್ರೊಫೈಲ್ ಸ್ನ್ಯಾಪ್‌ಶಾಟ್",
  "dashboard.name": "ಹೆಸರು",
  "dashboard.age": "ವಯಸ್ಸು",
  "dashboard.occupation": "ಉದ್ಯೋಗ",
  "dashboard.rationCard": "ರೇಷನ್ ಕಾರ್ಡ್",
  "dashboard.location": "ಸ್ಥಳ",
  "dashboard.editProfile": "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",

  // profile
  "profile.title": "ನಿಮ್ಮ ಪ್ರೊಫೈಲ್",
  "profile.viewSubtitle":
    "ನಿಮ್ಮ ಮಾಹಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ. ಯಾವಾಗ ಬೇಕಾದರೂ ನವೀಕರಿಸಿ — ಶಿಫಾರಸುಗಳು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪುನಶ್ಚೇತನಗೊಳ್ಳುತ್ತವೆ.",
  "profile.requiredNote":
    "* ಗುರುತಿಸಲಾದ ಕ್ಷೇತ್ರಗಳು ಕಡ್ಡಾಯ. ನಿಮ್ಮ ಉತ್ತರಗಳು ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಉಳಿಯುತ್ತವೆ.",
  "profile.guestSessionPrefix": "ಅತಿಥಿ ಅವಧಿ ·",
  "profile.verifyToBoost": "ವಿಶ್ವಾಸಾರ್ಹತೆ ಹೆಚ್ಚಿಸಲು ಪರಿಶೀಲಿಸಿ",
  "profile.verifiedMobile": "ಮೊಬೈಲ್ ಪರಿಶೀಲಿಸಲಾಗಿದೆ · +91 {mobile}",
  "profile.editProfileBtn": "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",
  "profile.viewSchemesBtn": "ಯೋಜನೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
  "profile.sectionBasicDetails": "ಮೂಲ ವಿವರಗಳು",
  "profile.sectionEconomicStatus": "ಆರ್ಥಿಕ ಸ್ಥಿತಿ",
  "profile.sectionCategoryOccupation": "ವರ್ಗ ಮತ್ತು ಉದ್ಯೋಗ",
  "profile.sectionLocation": "ಸ್ಥಳ",
  "profile.sectionSpecialConditions": "ವಿಶೇಷ ಪರಿಸ್ಥಿತಿಗಳು",
  "profile.specialConditionsHint": "ಐಚ್ಛಿಕ — ಅನ್ವಯಿಸುವುದನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "profile.rowFullName": "ಪೂರ್ಣ ಹೆಸರು",
  "profile.rowDob": "ಹುಟ್ಟಿದ ದಿನಾಂಕ",
  "profile.rowGender": "ಲಿಂಗ",
  "profile.rowMobile": "ಮೊಬೈಲ್",
  "profile.rowIncome": "ವಾರ್ಷಿಕ ಕುಟುಂಬ ಆದಾಯ",
  "profile.rowRationCard": "ರೇಷನ್ ಕಾರ್ಡ್",
  "profile.rowCategory": "ವರ್ಗ",
  "profile.rowMinorityType": "ಅಲ್ಪಸಂಖ್ಯಾತ ಪ್ರಕಾರ",
  "profile.rowOccupation": "ಉದ್ಯೋಗ",
  "profile.rowState": "ರಾಜ್ಯ",
  "profile.rowDistrict": "ಜಿಲ್ಲೆ",
  "profile.rowTaluk": "ತಾಲ್ಲೂಕು",
  "profile.rowVillage": "ಗ್ರಾಮ / ನಗರ",
  "profile.rowPincode": "ಪಿನ್ ಕೋಡ್",
  "profile.rowSpecialApplies": "ಅನ್ವಯಿಸುತ್ತದೆ",
  "profile.fieldFullNamePlaceholder": "ಉದಾ. ಪ್ರಿಯಾ ಶರ್ಮಾ",
  "profile.fieldGenderLabel": "ಲಿಂಗ",
  "profile.fieldMobileLabel": "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
  "profile.fieldMobilePlaceholder": "10-ಅಂಕಿಯ ಸಂಖ್ಯೆ",
  "profile.fieldIncomeLabel": "ವಾರ್ಷಿಕ ಕುಟುಂಬ ಆದಾಯ (₹)",
  "profile.fieldRationCardLabel": "ರೇಷನ್ ಕಾರ್ಡ್ ಪ್ರಕಾರ",
  "profile.rationCardPlaceholder": "ರೇಷನ್ ಕಾರ್ಡ್ ಆಯ್ಕೆಮಾಡಿ",
  "profile.rationApl": "APL (ಬಡತನ ರೇಖೆಗಿಂತ ಮೇಲೆ)",
  "profile.rationBpl": "BPL (ಬಡತನ ರೇಖೆಗಿಂತ ಕೆಳಗೆ)",
  "profile.rationAay": "AAY (ಅಂತ್ಯೋದಯ ಅನ್ನ ಯೋಜನೆ)",
  "profile.rationNone": "ರೇಷನ್ ಕಾರ್ಡ್ ಇಲ್ಲ",
  "profile.fieldCasteCategoryLabel": "ಜಾತಿ ವರ್ಗ",
  "profile.fieldOccupationLabel": "ಉದ್ಯೋಗ",
  "profile.occupationPlaceholder": "ಉದ್ಯೋಗ ಆಯ್ಕೆಮಾಡಿ",
  "profile.fieldMinorityTypeLabel": "ಅಲ್ಪಸಂಖ್ಯಾತ ಪ್ರಕಾರ",
  "profile.minorityTypePlaceholder": "ಅಲ್ಪಸಂಖ್ಯಾತ ಸಮುದಾಯ ಆಯ್ಕೆಮಾಡಿ",
  "profile.fieldStateLabel": "ರಾಜ್ಯ",
  "profile.fieldStateDefaultNote": "ಡೀಫಾಲ್ಟ್: ಕರ್ನಾಟಕ",
  "profile.fieldDistrictLabel": "ಜಿಲ್ಲೆ",
  "profile.districtPlaceholder": "ಜಿಲ್ಲೆ ಹುಡುಕಿ",
  "profile.fieldTalukLabel": "ತಾಲ್ಲೂಕು",
  "profile.talukPlaceholder": "ತಾಲ್ಲೂಕು ಹುಡುಕಿ",
  "profile.talukPlaceholderDisabled": "ಮೊದಲು ಜಿಲ್ಲೆ ಆಯ್ಕೆಮಾಡಿ",
  "profile.fieldVillageLabel": "ಗ್ರಾಮ / ನಗರ",
  "profile.villagePlaceholder": "ನಿಮ್ಮ ಗ್ರಾಮ/ನಗರವನ್ನು ಹುಡುಕಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ",
  "profile.villagePlaceholderDisabled": "ಮೊದಲು ಜಿಲ್ಲೆ ಆಯ್ಕೆಮಾಡಿ",
  "profile.fieldPincodeLabel": "ಪಿನ್ ಕೋಡ್",
  "profile.pincodePlaceholder": "6-ಅಂಕಿಯ",
  "profile.ageLabel": "ವಯಸ್ಸು: {age} ವರ್ಷಗಳು",
  "profile.conditionPregnant": "ಗರ್ಭಿಣಿ / ಬಾಣಂತಿ",
  "profile.conditionWidow": "ವಿಧವೆ",
  "profile.conditionDisabled": "ವಿಕಲಚೇತನ ವ್ಯಕ್ತಿ",
  "profile.crossFieldWarnings": "ಅಡ್ಡ-ಕ್ಷೇತ್ರ ಮೌಲ್ಯೀಕರಣ ಎಚ್ಚರಿಕೆಗಳು",
  "profile.cancel": "ರದ್ದುಮಾಡಿ",
  "profile.saveAndFind": "ಉಳಿಸಿ ಮತ್ತು ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ →",
  "profile.errName": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ",
  "profile.errDobRequired": "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹುಟ್ಟಿದ ದಿನಾಂಕವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "profile.errDobInvalid": "ಮಾನ್ಯ ಹುಟ್ಟಿದ ದಿನಾಂಕ ನಮೂದಿಸಿ",
  "profile.errMobile": "ಮಾನ್ಯ 10-ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ",
  "profile.errIncome": "ಮಾನ್ಯ ವಾರ್ಷಿಕ ಆದಾಯ ನಮೂದಿಸಿ",
  "profile.errOccupation": "ಉದ್ಯೋಗ ಆಯ್ಕೆಮಾಡಿ",
  "profile.errRationCard": "ನಿಮ್ಮ ರೇಷನ್ ಕಾರ್ಡ್ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "profile.errMinorityType": "ನಿಮ್ಮ ಅಲ್ಪಸಂಖ್ಯಾತ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
  "profile.errDistrict": "ನಿಮ್ಮ ಜಿಲ್ಲೆಯನ್ನು ನಮೂದಿಸಿ",
  "profile.errTaluk": "ನಿಮ್ಮ ತಾಲ್ಲೂಕನ್ನು ನಮೂದಿಸಿ",
  "profile.errVillage": "ನಿಮ್ಮ ಗ್ರಾಮ/ನಗರವನ್ನು ನಮೂದಿಸಿ",
  "profile.errPincode": "ಮಾನ್ಯ 6-ಅಂಕಿಯ ಪಿನ್ ಕೋಡ್ ನಮೂದಿಸಿ",
  "profile.toastFixFields": "ದಯವಿಟ್ಟು ಹೈಲೈಟ್ ಮಾಡಿದ ಕ್ಷೇತ್ರಗಳನ್ನು ಸರಿಪಡಿಸಿ",
  "profile.toastUpdated": "ಪ್ರೊಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ನವೀಕರಿಸಲಾಗಿದೆ.",
  "profile.genderFemale": "ಮಹಿಳೆ",
  "profile.genderMale": "ಪುರುಷ",
  "profile.genderOther": "ಇತರೆ",
  "profile.casteGeneral": "ಸಾಮಾನ್ಯ",
  "profile.casteOBC": "ಇತರೆ ಹಿಂದುಳಿದ ವರ್ಗ (OBC)",
  "profile.casteSC": "ಪರಿಶಿಷ್ಟ ಜಾತಿ (SC)",
  "profile.casteST": "ಪರಿಶಿಷ್ಟ ಪಂಗಡ (ST)",
  "profile.casteMinority": "ಅಲ್ಪಸಂಖ್ಯಾತ",
  "profile.minorityMuslim": "ಮುಸ್ಲಿಂ",
  "profile.minorityChristian": "ಕ್ರೈಸ್ತ",
  "profile.minoritySikh": "ಸಿಖ್",
  "profile.minorityJain": "ಜೈನ",
  "profile.minorityBuddhist": "ಬೌದ್ಧ",
  "profile.minorityParsi": "ಪಾರ್ಸಿ",
  "profile.minorityOther": "ಇತರೆ",

  // results
  "results.matchTitle": "{count} ಯೋಜನೆಗಳು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ",
  "results.rankedFor":
    "{name} ಗಾಗಿ ಹೊಂದಾಣಿಕೆಯಿಂದ ಶ್ರೇಣೀಕರಿಸಲಾಗಿದೆ · {eligible} ಅರ್ಹ · {ineligible} ಅನರ್ಹ",
  "results.editProfileRecalc": "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ ಮತ್ತು ಮರುಲೆಕ್ಕಾಚಾರ ಮಾಡಿ",
  "results.confidence": "ವಿಶ್ವಾಸಾರ್ಹತೆ",
  "results.eligibleSchemes": "ಅರ್ಹ ಯೋಜನೆಗಳು",
  "results.topMatchScore": "ಉನ್ನತ ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್",
  "results.filterTop": "ಉನ್ನತ ಆಯ್ಕೆಗಳು",
  "results.filterEligible": "ಅರ್ಹ",
  "results.filterIneligible": "ಅನರ್ಹ",
  "results.filterBookmarks": "ಬುಕ್‌ಮಾರ್ಕ್‌ಗಳು",
  "results.searchPlaceholder": "ಯೋಜನೆಗಳನ್ನು ಹುಡುಕಿ",
  "results.allCategories": "ಎಲ್ಲಾ ವರ್ಗಗಳು",
  "results.noSchemes": "ಈ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ತೋರಿಸಲು ಯಾವುದೇ ಯೋಜನೆಗಳಿಲ್ಲ.",
  "results.why": "ಏಕೆ: ",
  "results.eligibleBadge": "ಅರ್ಹ",
  "results.notEligibleBadge": "ಅನರ್ಹ",
  "results.matchScore": "ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್",
  "results.viewDetails": "ವಿವರಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
  "results.tellUsFirstTitle": "ಮೊದಲು ನಿಮ್ಮ ಬಗ್ಗೆ ತಿಳಿಸಿ",
  "results.tellUsFirstDesc": "ನಿಮ್ಮನ್ನು ಯೋಜನೆಗಳೊಂದಿಗೆ ಹೊಂದಿಸಲು ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಪೂರ್ಣಗೊಳಿಸಿ.",
  "results.fillProfileCta": "ಪ್ರೊಫೈಲ್ ಭರ್ತಿ ಮಾಡಿ →",

  // scheme detail
  "scheme.backToResults": "ಫಲಿತಾಂಶಗಳಿಗೆ ಹಿಂತಿರುಗಿ",
  "scheme.bookmarked": "ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಲಾಗಿದೆ",
  "scheme.bookmark": "ಬುಕ್‌ಮಾರ್ಕ್",
  "scheme.eligibleTitle": "ನೀವು ಅರ್ಹರಾಗಿ ಕಾಣುತ್ತೀರಿ",
  "scheme.notEligibleTitle": "ನೀವು ಅರ್ಹರಾಗಿಲ್ಲದಿರಬಹುದು",
  "scheme.matchScoreLine": "ಹೊಂದಾಣಿಕೆ ಸ್ಕೋರ್: {score}/100 · {explanation}",
  "scheme.keyBenefits": "ಪ್ರಮುಖ ಪ್ರಯೋಜನಗಳು",
  "scheme.requiredDocuments": "ಅಗತ್ಯ ದಾಖಲೆಗಳು",
  "scheme.whyMatches": "ಇದು ನಿಮಗೆ ಏಕೆ ಹೊಂದಿಕೆಯಾಗುತ್ತದೆ",
  "scheme.noCriteriaMatched": "ಯಾವುದೇ ನಿರ್ದಿಷ್ಟ ಮಾನದಂಡಗಳು ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ.",
  "scheme.gapsToAddress": "ಪರಿಹರಿಸಬೇಕಾದ ಕೊರತೆಗಳು",
  "scheme.meetAllCriteria": "ನೀವು ಎಲ್ಲಾ ಮಾನದಂಡಗಳನ್ನು ಪೂರೈಸುತ್ತೀರಿ.",
  "scheme.readyToApply": "ಅರ್ಜಿ ಸಲ್ಲಿಸಲು ಸಿದ್ಧರಿದ್ದೀರಾ?",
  "scheme.redirectNote": "ನಿಮ್ಮನ್ನು ಅಧಿಕೃತ ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್‌ಗೆ ಮರುನಿರ್ದೇಶಿಸಲಾಗುತ್ತದೆ.",
  "scheme.allSchemes": "ಎಲ್ಲಾ ಯೋಜನೆಗಳು",
  "scheme.applyNow": "ಈಗ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ",

  // chatbot
  "chatbot.greeting":
    "ನಮಸ್ಕಾರ! ನಾನು ಸಹಾಯಕ್ ಸಹಾಯಕ. ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ಅರ್ಹತೆ, ದಾಖಲೆಗಳು ಅಥವಾ ಈ ಆ್ಯಪ್ ಬಳಸುವ ಬಗ್ಗೆ ನನ್ನನ್ನು ಕೇಳಿ.",
  "chatbot.openAria": "ಸಹಾಯಕ್ ಸಹಾಯಕವನ್ನು ತೆರೆಯಿರಿ",
  "chatbot.title": "ಸಹಾಯಕ್ ಸಹಾಯಕ",
  "chatbot.subtitle": "ಯೋಜನೆಗಳು ಮತ್ತು ಅರ್ಹತೆ ಬಗ್ಗೆ ಕೇಳಿ",
  "chatbot.closeAria": "ಚಾಟ್ ಮುಚ್ಚಿ",
  "chatbot.thinking": "ಯೋಚಿಸುತ್ತಿದೆ…",
  "chatbot.placeholder": "ಯೋಜನೆ, ಅರ್ಹತೆ ಬಗ್ಗೆ ಕೇಳಿ…",
  "chatbot.errRateLimited":
    "ಈಗ ಹೆಚ್ಚು ವಿನಂತಿಗಳು ಬರುತ್ತಿವೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "chatbot.errNoCredits": "AI ಸೇವೆಯ ಕ್ರೆಡಿಟ್‌ಗಳು ಮುಗಿದಿವೆ. ದಯವಿಟ್ಟು ಆ್ಯಪ್ ಮಾಲೀಕರನ್ನು ಸಂಪರ್ಕಿಸಿ.",
  "chatbot.errGeneric": "ಕ್ಷಮಿಸಿ, ಸಹಾಯಕವನ್ನು ತಲುಪಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  "chatbot.errNoReply":
    "ಇದರ ಬಗ್ಗೆ ನನಗೆ ಖಚಿತವಿಲ್ಲ — ದಯವಿಟ್ಟು ಅಧಿಕೃತ ಯೋಜನಾ ವಿವರಗಳ ಪುಟವನ್ನು ಪರಿಶೀಲಿಸಿ.",
  "chatbot.errNetwork": "ನೆಟ್‌ವರ್ಕ್ ದೋಷ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};

const dictionaries: Record<Lang, Record<keyof typeof en, string>> = { en, kn };

export type TranslationKey = keyof typeof en;

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function loadStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "kn" ? "kn" : "en";
  } catch {
    return "en";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(loadStoredLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const setLang = (next: Lang) => setLangState(next);
  const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
    interpolate(dictionaries[lang][key] ?? dictionaries.en[key], vars);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
