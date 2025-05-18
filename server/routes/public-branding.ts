import { Router, Request, Response } from 'express';
import { db } from '../../db';

const router = Router();

// Get system branding settings - public, no auth required
router.get('/', async (req: Request, res: Response) => {
  console.log('PUBLIC BRANDING ENDPOINT CALLED');
  res.header('X-Accessed-Public-Branding', 'true');
  
  try {
    // Create a default branding object
    const defaultBranding = {
      id: 1,
      organizationName: "NexusMCP Platform",
      primaryColor: "#234f8e",
      secondaryColor: "#2c9a73",
      accentColor: "#3986ca",
      enableDarkMode: true,
      defaultTheme: "system",
      primaryFontFamily: "Inter, system-ui, sans-serif",
      secondaryFontFamily: "Inter, system-ui, sans-serif",
      copyrightText: `© ${new Date().getFullYear()} NexusMCP. All rights reserved.`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    try {
      // Just select from table directly to avoid schema mismatches
      const result = await db.execute(
        `SELECT id, organization_name as "organizationName", 
         primary_color as "primaryColor", secondary_color as "secondaryColor", 
         accent_color as "accentColor", enable_dark_mode as "enableDarkMode", 
         default_theme as "defaultTheme", primary_font_family as "primaryFontFamily", 
         secondary_font_family as "secondaryFontFamily", copyright_text as "copyrightText", 
         created_at as "createdAt", updated_at as "updatedAt" 
         FROM system_branding LIMIT 1`
      );
      
      // If we have results
      if (result.rows && result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
      
      // If no results, create a default branding record
      try {
        await db.execute({
          text: `INSERT INTO system_branding 
                (organization_name, primary_color, secondary_color, accent_color, 
                 enable_dark_mode, default_theme, primary_font_family, secondary_font_family, copyright_text) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          values: [
            defaultBranding.organizationName,
            defaultBranding.primaryColor,
            defaultBranding.secondaryColor,
            defaultBranding.accentColor,
            defaultBranding.enableDarkMode,
            defaultBranding.defaultTheme,
            defaultBranding.primaryFontFamily,
            defaultBranding.secondaryFontFamily,
            defaultBranding.copyrightText
          ]
        });
        
        // Return the default branding
        return res.json(defaultBranding);
      } catch (insertError) {
        console.error('Error creating default branding:', insertError);
        // Return the default
        return res.json(defaultBranding);
      }
    } catch (queryError) {
      console.error('Error querying branding table:', queryError);
      // Return the default
      return res.json(defaultBranding);
    }
  } catch (error) {
    console.error('Error in branding route:', error);
    // In case of any error, return a fallback branding
    return res.json({
      id: 1,
      organizationName: "NexusMCP Platform",
      primaryColor: "#234f8e",
      secondaryColor: "#2c9a73",
      accentColor: "#3986ca",
      enableDarkMode: true,
      defaultTheme: "system",
      primaryFontFamily: "Inter, system-ui, sans-serif",
      secondaryFontFamily: "Inter, system-ui, sans-serif",
      copyrightText: `© ${new Date().getFullYear()} NexusMCP. All rights reserved.`,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
});

export default router;