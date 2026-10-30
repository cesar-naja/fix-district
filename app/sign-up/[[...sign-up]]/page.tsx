import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center py-12">
      <Suspense>
        <SignUp path="/sign-up" signInUrl="/sign-in" />
      </Suspense>
    </div>
  );
}
