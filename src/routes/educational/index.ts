import express from 'express';
import educationalCategoryRoutes from './educational-category.routes';
import educationalResourceRoutes from './educational-resource.routes';

const router = express.Router();

// Mount category routes
router.use('/categories', educationalCategoryRoutes);

// Mount resource routes  
router.use('/resources', educationalResourceRoutes);

export default router; 