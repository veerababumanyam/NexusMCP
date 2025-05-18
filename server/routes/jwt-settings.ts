import express from 'express';
import { JwtService } from '../services/jwt/JwtService';
import { z } from 'zod';
import { 
  jwtSettingsInsertSchema, 
  jwtClaimInsertSchema,
  JwtSettings,
  JwtClaimMapping
} from '@shared/schema_jwt';
import logger from '../logger';

const router = express.Router();
const jwtService = JwtService.getInstance();

/**
 * Get all JWT settings
 */
router.get('/', async (req, res) => {
  try {
    const settings = await jwtService.getAllSettings();
    res.json(settings);
  } catch (error) {
    logger.error('Error fetching JWT settings', { error });
    res.status(500).json({ error: 'Failed to fetch JWT settings' });
  }
});

/**
 * Get JWT settings by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const settings = await jwtService.getSettingsById(id);
    if (!settings) {
      return res.status(404).json({ error: 'JWT settings not found' });
    }

    res.json(settings);
  } catch (error) {
    logger.error(`Error fetching JWT settings with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to fetch JWT settings' });
  }
});

/**
 * Create new JWT settings
 */
router.post('/', async (req, res) => {
  try {
    const data = jwtSettingsInsertSchema.parse(req.body);
    const settings = await jwtService.createSettings(data);
    res.status(201).json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating JWT settings', { error });
    res.status(500).json({ error: 'Failed to create JWT settings' });
  }
});

/**
 * Update JWT settings
 */
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const data = jwtSettingsInsertSchema.partial().parse(req.body);
    const settings = await jwtService.updateSettings(id, data);
    res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error(`Error updating JWT settings with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to update JWT settings' });
  }
});

/**
 * Delete JWT settings
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    await jwtService.deleteSettings(id);
    res.sendStatus(204);
  } catch (error) {
    logger.error(`Error deleting JWT settings with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to delete JWT settings' });
  }
});

/**
 * Rotate keys for JWT settings
 */
router.post('/:id/rotate', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const settings = await jwtService.rotateKeys(id);
    res.json(settings);
  } catch (error) {
    logger.error(`Error rotating keys for JWT settings with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to rotate keys' });
  }
});

/**
 * Get JWT claim mappings for a specific settings
 */
router.get('/:id/claims', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const claims = await jwtService.getClaimMappings(id);
    res.json(claims);
  } catch (error) {
    logger.error(`Error fetching JWT claim mappings for settings ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to fetch JWT claim mappings' });
  }
});

/**
 * Create a new claim mapping
 */
router.post('/:id/claims', async (req, res) => {
  try {
    const settingsId = parseInt(req.params.id);
    if (isNaN(settingsId)) {
      return res.status(400).json({ error: 'Invalid settings ID format' });
    }

    // Ensure the settings exist
    const settings = await jwtService.getSettingsById(settingsId);
    if (!settings) {
      return res.status(404).json({ error: 'JWT settings not found' });
    }

    const data = jwtClaimInsertSchema.parse({ ...req.body, settingsId });
    const claim = await jwtService.createClaimMapping(data);
    res.status(201).json(claim);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error('Error creating JWT claim mapping', { error });
    res.status(500).json({ error: 'Failed to create JWT claim mapping' });
  }
});

/**
 * Update a claim mapping
 */
router.put('/claims/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const data = jwtClaimInsertSchema.partial().parse(req.body);
    const claim = await jwtService.updateClaimMapping(id, data);
    res.json(claim);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    logger.error(`Error updating JWT claim mapping with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to update JWT claim mapping' });
  }
});

/**
 * Delete a claim mapping
 */
router.delete('/claims/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    await jwtService.deleteClaimMapping(id);
    res.sendStatus(204);
  } catch (error) {
    logger.error(`Error deleting JWT claim mapping with ID ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to delete JWT claim mapping' });
  }
});

/**
 * Generate test JWT token
 */
router.post('/:id/test-token', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const payload = req.body.payload || {};
    const testToken = await jwtService.generateTestToken(id, payload);
    res.json(testToken);
  } catch (error) {
    logger.error(`Error generating test JWT token for settings ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to generate test JWT token' });
  }
});

/**
 * Get JWKS (JSON Web Key Set) for public key distribution
 */
router.get('/:id/jwks.json', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const jwks = await jwtService.getJwks(id);
    res.json(jwks);
  } catch (error) {
    logger.error(`Error generating JWKS for JWT settings ${req.params.id}`, { error });
    res.status(500).json({ error: 'Failed to generate JWKS' });
  }
});

export { router as jwtSettingsRouter };