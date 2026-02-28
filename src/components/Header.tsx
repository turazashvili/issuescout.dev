"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./ThemeToggle";
import {
  Bookmark,
  LogOut,
  Sparkles,
  Search,
  Github,
  Settings,
} from "lucide-react";
import { IssueScoutIcon } from "./IssueScoutLogo";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500">
              <IssueScoutIcon className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              IssueScout
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link href="/explore">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                <Search className="h-4 w-4" />
                Explore
              </Button>
            </Link>
            {session && (
              <>
                <Link href="/explore?tab=recommended">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <Sparkles className="h-4 w-4" />
                    For You
                  </Button>
                </Link>
                <Link href="/bookmarks">
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <Bookmark className="h-4 w-4" />
                    Saved
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage
                      src={session.user?.image || session.user?.avatarUrl}
                      alt={session.user?.name || ""}
                    />
                    <AvatarFallback>
                      {session.user?.name?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm md:inline">
                    {session.user?.login || session.user?.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/bookmarks" className="gap-2">
                    <Bookmark className="h-4 w-4" />
                    Saved Issues
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Preferences
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    document.cookie = "__Host-authjs.csrf-token=; path=/; max-age=0; secure; samesite=lax";
                    document.cookie = "__Secure-authjs.callback-url=; path=/; max-age=0; secure; samesite=lax";
                    signOut();
                  }}
                  className="gap-2 text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              onClick={() => signIn("github")}
              size="sm"
              className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
            >
              <Github className="h-4 w-4" />
              Sign in with GitHub
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
