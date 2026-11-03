import Image from "next/image";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="login-fit flex h-dvh items-center justify-center overflow-hidden p-4">
      <div className="w-full max-w-xs">
        <div className="login-header mb-8 text-center">
          <Image src="/logo.svg" alt="" width={56} height={56} unoptimized priority className="mx-auto mb-3 size-14" />
          <h1 className="text-2xl font-bold">เจ๊แหม่มสับปะรด</h1>
          <p className="text-sm text-stone-400">ระบบขายขนม</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
