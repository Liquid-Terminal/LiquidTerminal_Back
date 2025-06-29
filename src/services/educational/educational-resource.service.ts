import { 
  EducationalResourceCreateInput, 
  EducationalResourceUpdateInput, 
  EducationalResourceResponse,
  EducationalResourceCategoryCreateInput,
  EducationalResourceCategoryResponse 
} from '../../types/educational.types';
import { 
  EducationalResourceNotFoundError, 
  EducationalResourceAlreadyExistsError,
  EducationalResourceValidationError,
  EducationalResourceCategoryAlreadyExistsError,
  EducationalResourceCategoryNotFoundError,
  EducationalCategoryNotFoundError,
  EducationalUrlError 
} from '../../errors/educational.errors';
import { logDeduplicator } from '../../utils/logDeduplicator';
import { CACHE_PREFIX, CACHE_KEYS } from '../../constants/cache.constants';
import { 
  educationalResourceCreateSchema, 
  educationalResourceUpdateSchema, 
  educationalResourceQuerySchema,
  educationalResourceCategoryCreateSchema 
} from '../../schemas/educational.schema';
import { educationalResourceRepository, educationalCategoryRepository } from '../../repositories';
import { BaseService } from '../../core/crudBase.service';
import { cacheService } from '../../core/cache.service';
import { transactionService } from '../../core/transaction.service';
import { CACHE_TTL } from '../../constants/cache.constants';

type EducationalResourceQueryParams = {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
};

export class EducationalResourceService extends BaseService<
  EducationalResourceResponse, 
  EducationalResourceCreateInput, 
  EducationalResourceUpdateInput, 
  EducationalResourceQueryParams
> {
  protected repository = educationalResourceRepository;
  protected cacheKeyPrefix = CACHE_PREFIX.EDUCATIONAL_RESOURCE;
  protected validationSchemas = {
    create: educationalResourceCreateSchema,
    update: educationalResourceUpdateSchema,
    query: educationalResourceQuerySchema
  };
  protected errorClasses = {
    notFound: EducationalResourceNotFoundError,
    alreadyExists: EducationalResourceAlreadyExistsError,
    validation: EducationalResourceValidationError
  };

  protected async checkExists(data: EducationalResourceCreateInput): Promise<boolean> {
    return await this.repository.existsByUrl(data.url);
  }

  protected async checkExistsForUpdate(id: number, data: EducationalResourceUpdateInput): Promise<boolean> {
    if (data.url) {
      const resource = await this.repository.findById(id);
      if (resource && data.url !== resource.url) {
        return await this.repository.existsByUrl(data.url);
      }
    }
    return false;
  }

  protected async checkCanDelete(id: number): Promise<void> {
    return;
  }

  private async validateUrl(url: string): Promise<void> {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'https:') {
        throw new EducationalUrlError('Only HTTPS URLs are allowed');
      }
    } catch (error) {
      throw new EducationalUrlError('Invalid URL format');
    }
  }



  async assignToCategory(data: EducationalResourceCategoryCreateInput): Promise<EducationalResourceCategoryResponse> {
    try {
      const validatedData = this.validateInput(data, educationalResourceCategoryCreateSchema);

      return await transactionService.execute(async (tx) => {
        this.repository.setPrismaClient(tx);
        educationalCategoryRepository.setPrismaClient(tx);

        const resource = await this.repository.findById(validatedData.resourceId);
        if (!resource) {
          throw new EducationalResourceNotFoundError();
        }

        const category = await educationalCategoryRepository.findById(validatedData.categoryId);
        if (!category) {
          throw new EducationalCategoryNotFoundError();
        }

        const existingAssignment = await this.repository.isAssignedToCategory(
          validatedData.resourceId, 
          validatedData.categoryId
        );
        if (existingAssignment) {
          throw new EducationalResourceCategoryAlreadyExistsError();
        }

        return await this.repository.assignToCategory(validatedData);
      });
    } catch (error) {
      throw error;
    } finally {
      this.repository.resetPrismaClient();
      educationalCategoryRepository.resetPrismaClient();
    }
  }

  async create(data: EducationalResourceCreateInput): Promise<EducationalResourceResponse> {
    await this.validateUrl(data.url);
    return await super.create(data);
  }

  async update(id: number, data: EducationalResourceUpdateInput): Promise<EducationalResourceResponse> {
    if (data.url) {
      await this.validateUrl(data.url);
    }
    return await super.update(id, data);
  }

  async removeFromCategory(resourceId: number, categoryId: number): Promise<void> {
    try {
      return await transactionService.execute(async (tx) => {
        this.repository.setPrismaClient(tx);

        const resource = await this.repository.findById(resourceId);
        if (!resource) {
          throw new EducationalResourceNotFoundError();
        }

        const isAssigned = await this.repository.isAssignedToCategory(resourceId, categoryId);
        if (!isAssigned) {
          throw new EducationalResourceCategoryNotFoundError();
        }

        await this.repository.removeFromCategory(resourceId, categoryId);
        
        logDeduplicator.info('Resource removed from category successfully', { 
          resourceId,
          categoryId
        });
      });
    } catch (error) {
      logDeduplicator.error('Error removing resource from category:', { error, resourceId, categoryId });
      throw error;
    } finally {
      this.repository.resetPrismaClient();
    }
  }

  async getResourcesByCategory(categoryId: number): Promise<EducationalResourceResponse[]> {
    try {
      return await cacheService.getOrSet(
        CACHE_KEYS.EDUCATIONAL_RESOURCE_BY_CATEGORY(categoryId),
        async () => {
          const category = await educationalCategoryRepository.findById(categoryId);
          if (!category) {
            throw new EducationalCategoryNotFoundError();
          }

          const resources = await this.repository.findByCategory(categoryId);
          
          logDeduplicator.info('Resources by category retrieved successfully', { 
            categoryId,
            count: resources.length
          });
          
          return resources;
        },
        CACHE_TTL.MEDIUM
      );
    } catch (error) {
      if (error instanceof EducationalCategoryNotFoundError) {
        throw error;
      }
      logDeduplicator.error('Error fetching resources by category:', { error, categoryId });
      throw error;
    }
  }


}
