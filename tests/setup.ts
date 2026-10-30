// Tests must never use live credentials or a live Firebase project.
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
process.env.FIREBASE_PROJECT_ID = "demo-fix-district";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-fix-district";