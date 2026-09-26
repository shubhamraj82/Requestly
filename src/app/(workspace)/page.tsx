import { currentUser } from "@/modules/authentication/actions";
import UserButton from "@/modules/authentication/components/user-button";
import Image from "next/image";

export default async function Home() {
  const user= await currentUser();
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <UserButton user={user}/>
    </div>
  );
}
