import { auth } from "@/auth";
import Link from "next/link";
import React from "react";
import { SvgIcon } from "@/common/SvgIcon";
import { Button } from "@radix-ui/themes";
import { PreferencesButton } from "@/components/PreferencesButton";
import type { Locale } from '@/types/i18n';


async function AppBar({ lang }: { lang: Locale }) {
  const session = await auth();

  return (
    <div className="flex justify-between items-center w-full">
      <Link href="/" aria-label="homepage" className="flex items-center">
        <SvgIcon src="/img/svg/logo.svg" width="101px" height="64px" />
      </Link>
      <div className="p-2 flex gap-4 items-center">
        {session?.user ? (
          <>
            <Button variant="ghost" asChild>
              <Link href={`/${lang}/harbor`}>
                Harbor
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/dashboard/profile">
                Profile
              </Link>
            </Button>
            <PreferencesButton />
            <Button variant="ghost" asChild>
              <Link href="/signout">
                Sign Out
              </Link>
            </Button>
          </>
        ) : (
          <>
            <PreferencesButton />
            <Button variant="ghost" asChild>
              <Link href="/signin">
                Sign In
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default AppBar;
