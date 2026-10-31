import Image from "next/image";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Image src="/icon.svg" alt="" width={64} height={64} unoptimized className="mx-auto mb-2" />
          <h1 className="text-2xl font-bold">เจ๊แหม่มสับปะรด</h1>
          <p className="text-stone-500">ระบบขายขนม</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
