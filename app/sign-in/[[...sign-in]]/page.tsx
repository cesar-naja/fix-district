import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-12">
      <Suspense>
        <SignIn path="/sign-in" signUpUrl="/sign-up" />
      </Suspense>
    </div>
  );
}
