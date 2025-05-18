import { Check, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supportedLanguages } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-provider";
import { cn } from "@/lib/utils";

interface LanguageSelectorProps {
  variant?: "default" | "subtle" | "icon" | "secondary";
  showLabel?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  onLanguageChange?: (language: string) => void;
}

export function LanguageSelector({
  variant = "default",
  showLabel = true,
  align = "end",
  className,
  onLanguageChange,
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage } = useI18n();

  // Function to handle language change
  const handleLanguageChange = (languageCode: string) => {
    changeLanguage(languageCode);
    // Call the onLanguageChange callback if provided
    if (onLanguageChange) {
      onLanguageChange(languageCode);
    }
  };

  // Rendered based on the variant
  const renderTrigger = () => {
    switch (variant) {
      case "subtle":
        return (
          <Button
            variant="ghost"
            size="sm"
            className={cn("flex items-center gap-2 text-muted-foreground", className)}
          >
            <Globe className="h-4 w-4" />
            {showLabel && (supportedLanguages[currentLanguage as keyof typeof supportedLanguages] || "English")}
          </Button>
        );
      case "icon":
        return (
          <Button
            variant="outline"
            size="icon"
            className={cn("text-muted-foreground", className)}
          >
            <Globe className="h-4 w-4" />
          </Button>
        );
      case "secondary":
        return (
          <Button
            variant="secondary"
            size="sm"
            className={cn("flex items-center gap-2", className)}
          >
            <Globe className="h-4 w-4" />
            {showLabel && (supportedLanguages[currentLanguage as keyof typeof supportedLanguages] || "English")}
          </Button>
        );
      default:
        return (
          <Button
            variant="outline"
            size="sm"
            className={cn("flex items-center gap-2", className)}
          >
            <Globe className="h-4 w-4" />
            {showLabel && (supportedLanguages[currentLanguage as keyof typeof supportedLanguages] || "English")}
          </Button>
        );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{renderTrigger()}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <div className="p-2 text-sm font-medium text-muted-foreground">
          {t("language.select")}
        </div>
        <div className="max-h-60 overflow-y-auto">
          {Object.entries(supportedLanguages).map(([code, name]) => (
            <DropdownMenuItem
              key={code}
              onClick={() => handleLanguageChange(code)}
              className="flex items-center justify-between"
            >
              <span>{name}</span>
              {currentLanguage === code && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}