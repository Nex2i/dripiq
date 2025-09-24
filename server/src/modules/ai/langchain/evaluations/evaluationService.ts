import { createLangfuseClient } from '../config/langfuse.config';
import { logger } from '@/libs/logger';
import { z } from 'zod';

// Define evaluation types
export interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number; // 0-1
}

export interface EvaluationResult {
  score: number; // 0-1
  feedback: string;
  criteriaScores: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface SiteAnalysisEvaluation {
  domain: string;
  expectedOutput: {
    summary?: string;
    products?: string[];
    services?: string[];
    differentiators?: string[];
    targetMarket?: string;
    tone?: string;
  };
  actualOutput: Record<string, any>;
  evaluation: EvaluationResult;
}

export class EvaluationService {
  private static instance: EvaluationService;
  private langfuseClient = createLangfuseClient();

  private constructor() {}

  static getInstance(): EvaluationService {
    if (!EvaluationService.instance) {
      EvaluationService.instance = new EvaluationService();
    }
    return EvaluationService.instance;
  }

  /**
   * Evaluate site analysis output
   */
  async evaluateSiteAnalysis(
    domain: string,
    expectedOutput: Partial<SiteAnalysisEvaluation['expectedOutput']>,
    actualOutput: Record<string, any>
  ): Promise<SiteAnalysisEvaluation> {
    const criteria: EvaluationCriteria[] = [
      {
        name: 'completeness',
        description: 'How complete is the analysis (all sections filled)',
        weight: 0.3,
      },
      {
        name: 'accuracy',
        description: 'How accurate and factual is the information',
        weight: 0.3,
      },
      {
        name: 'clarity',
        description: 'How clear and well-structured is the output',
        weight: 0.2,
      },
      {
        name: 'relevance',
        description: 'How relevant is the analysis to the domain',
        weight: 0.2,
      },
    ];

    // Perform evaluation
    const evaluation = await this.evaluateWithCriteria(criteria, {
      domain,
      expectedOutput,
      actualOutput,
    });

    // Log evaluation to LangFuse
    this.langfuseClient?.event({
      name: 'site-analysis-evaluation',
      input: {
        domain,
        expectedOutput,
        actualOutput: JSON.stringify(actualOutput).substring(0, 1000),
      },
      output: {
        score: evaluation.score,
        feedback: evaluation.feedback.substring(0, 500),
        criteriaScores: evaluation.criteriaScores,
      },
      metadata: {
        type: 'site-analysis-evaluation',
        domain,
      },
    });

    return {
      domain,
      expectedOutput,
      actualOutput,
      evaluation,
    };
  }

  /**
   * Generic evaluation with custom criteria
   */
  async evaluateWithCriteria(
    criteria: EvaluationCriteria[],
    context: Record<string, any>
  ): Promise<EvaluationResult> {
    try {
      const criteriaScores: Record<string, number> = {};

      // Simple rule-based evaluation (in production, you might use an LLM)
      for (const criterion of criteria) {
        const score = await this.evaluateCriterion(criterion, context);
        criteriaScores[criterion.name] = score;
      }

      // Calculate weighted average
      const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
      const weightedScore = criteria.reduce(
        (sum, c) => sum + (criteriaScores[c.name] || 0) * c.weight,
        0
      ) / totalWeight;

      const feedback = this.generateFeedback(criteria, criteriaScores, context);

      return {
        score: Math.round(weightedScore * 100) / 100, // Round to 2 decimal places
        feedback,
        criteriaScores,
        metadata: context,
      };
    } catch (error) {
      logger.error('Error in evaluation:', error);
      return {
        score: 0,
        feedback: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        criteriaScores: {},
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Evaluate a single criterion
   */
  private async evaluateCriterion(
    criterion: EvaluationCriteria,
    context: Record<string, any>
  ): Promise<number> {
    const { domain, expectedOutput, actualOutput } = context;

    switch (criterion.name) {
      case 'completeness':
        return this.evaluateCompleteness(actualOutput, expectedOutput);

      case 'accuracy':
        return this.evaluateAccuracy(domain, actualOutput);

      case 'clarity':
        return this.evaluateClarity(actualOutput);

      case 'relevance':
        return this.evaluateRelevance(domain, actualOutput);

      default:
        return 0.5; // Default neutral score
    }
  }

  /**
   * Evaluate completeness of the analysis
   */
  private evaluateCompleteness(
    actualOutput: Record<string, any>,
    expectedOutput: Record<string, any>
  ): number {
    const sections = ['summary', 'products', 'services', 'differentiators', 'targetMarket', 'tone'];
    const expectedSections = Object.keys(expectedOutput).filter(k => expectedOutput[k]);

    if (expectedSections.length === 0) return 1.0; // No expectations, consider complete

    let filledSections = 0;
    for (const section of expectedSections) {
      const actualValue = actualOutput[section];
      if (actualValue && typeof actualValue === 'string' && actualValue.trim().length > 10) {
        filledSections++;
      } else if (actualValue && Array.isArray(actualValue) && actualValue.length > 0) {
        filledSections++;
      }
    }

    return expectedSections.length > 0 ? filledSections / expectedSections.length : 1.0;
  }

  /**
   * Evaluate accuracy of the analysis
   */
  private evaluateAccuracy(domain: string, actualOutput: Record<string, any>): number {
    // Simple heuristics for accuracy
    const summary = actualOutput.summary || '';
    const products = actualOutput.products || [];
    const services = actualOutput.services || [];

    let score = 0.5; // Base score

    // Check if summary mentions the domain
    if (summary.toLowerCase().includes(domain.toLowerCase().replace(/^https?:\/\//, ''))) {
      score += 0.2;
    }

    // Check if there are products or services mentioned
    if (products.length > 0 || services.length > 0) {
      score += 0.3;
    }

    // Check summary length (too short might indicate incomplete analysis)
    if (summary.length > 50) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Evaluate clarity of the output
   */
  private evaluateClarity(actualOutput: Record<string, any>): number {
    const summary = actualOutput.summary || '';
    const products = actualOutput.products || [];
    const services = actualOutput.services || [];

    let score = 0.5; // Base score

    // Check if summary is well-structured
    if (summary.length > 20 && summary.length < 1000) {
      score += 0.3;
    }

    // Check if arrays are reasonable size
    if (products.length >= 0 && products.length <= 10) {
      score += 0.1;
    }

    if (services.length >= 0 && services.length <= 10) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Evaluate relevance of the analysis
   */
  private evaluateRelevance(domain: string, actualOutput: Record<string, any>): number {
    const summary = actualOutput.summary || '';

    // Check if the analysis seems relevant to a business website
    const businessKeywords = ['company', 'business', 'service', 'product', 'solution', 'platform'];
    const relevantKeywords = businessKeywords.filter(keyword =>
      summary.toLowerCase().includes(keyword)
    );

    return relevantKeywords.length / businessKeywords.length;
  }

  /**
   * Generate feedback based on evaluation
   */
  private generateFeedback(
    criteria: EvaluationCriteria[],
    criteriaScores: Record<string, number>,
    context: Record<string, any>
  ): string {
    const { domain, actualOutput } = context;

    const feedbackParts: string[] = [];

    // Overall assessment
    const averageScore = Object.values(criteriaScores).reduce((sum, score) => sum + score, 0) /
                        Object.keys(criteriaScores).length;

    if (averageScore >= 0.8) {
      feedbackParts.push('Excellent analysis quality.');
    } else if (averageScore >= 0.6) {
      feedbackParts.push('Good analysis with room for improvement.');
    } else if (averageScore >= 0.4) {
      feedbackParts.push('Analysis needs significant improvement.');
    } else {
      feedbackParts.push('Poor analysis quality.');
    }

    // Criterion-specific feedback
    for (const criterion of criteria) {
      const score = criteriaScores[criterion.name] || 0;

      if (score < 0.5) {
        feedbackParts.push(`${criterion.description}: Low score (${Math.round(score * 100)}%)`);
      } else if (score >= 0.9) {
        feedbackParts.push(`${criterion.description}: Excellent (${Math.round(score * 100)}%)`);
      }
    }

    return feedbackParts.join(' ');
  }

  /**
   * Log evaluation metrics to LangFuse
   */
  async logEvaluationMetrics(
    evaluationType: string,
    metrics: Record<string, number>,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    this.langfuseClient?.event({
      name: 'evaluation-metrics',
      input: {
        evaluationType,
        metrics,
      },
      output: {
        timestamp: new Date().toISOString(),
        metrics,
      },
      metadata: {
        type: 'evaluation-metrics',
        evaluationType,
        ...metadata,
      },
    });
  }
}

// Export singleton instance
export const evaluationService = EvaluationService.getInstance();