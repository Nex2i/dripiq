/**
 * LangFuse-First AI Agent Usage Examples
 *
 * This file demonstrates how to use the new LangFuse-first AI agents.
 * All examples require LangFuse to be properly configured.
 */

import {
  initializeObservability,
  initializeAgents,
  siteAnalysisAgent,
  vendorFitAgent,
  contactExtractionAgent,
  contactStrategyAgent,
  getLangFuseStatus,
  type AgentExecutionOptions,
} from '@/modules/ai';
import { logger } from '@/libs/logger';

/**
 * Example 1: System Initialization
 * Required before using any agents
 */
export const initializeAISystem = async (): Promise<void> => {
  try {
    logger.info('Initializing LangFuse-first AI system...');

    // Step 1: Initialize observability services
    await initializeObservability();
    logger.info('Observability services initialized');

    // Step 2: Verify LangFuse status
    const status = getLangFuseStatus();

    if (!status.available) {
      throw new Error('LangFuse service is not available - check configuration');
    }

    // Step 3: Initialize agents (will fail if LangFuse not available)
    await initializeAgents();

    logger.info('AI system fully initialized and ready for use');
  } catch (error) {
    logger.error('AI system initialization failed:', error);
    throw error;
  }
};

/**
 * Example 2: Site Analysis with Full Observability
 */
export const analyzeSiteExample = async (): Promise<void> => {
  const domain = 'example.com';

  const options: AgentExecutionOptions = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    sessionId: 'session-789',
    metadata: {
      source: 'example-usage',
      campaign: 'demo',
    },
  };

  try {
    logger.info('Starting site analysis with LangFuse tracing', { domain });

    const result = await siteAnalysisAgent.analyze(domain, options);

    logger.info('Site analysis completed successfully', {
      domain,
      traceId: result.traceId,
      executionTimeMs: result.metadata?.executionTimeMs,
      totalIterations: result.totalIterations,
      summary: result.finalResponseParsed.summary.substring(0, 100) + '...',
    });

    // Access enhanced result data
    console.log('Analysis Results:', {
      traceId: result.traceId,
      products: result.finalResponseParsed.products,
      services: result.finalResponseParsed.services,
      targetMarket: result.finalResponseParsed.targetMarket,
      executionTime: result.metadata?.executionTimeMs,
    });
  } catch (error) {
    logger.error('Site analysis failed', {
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: (error as any).traceId,
      metadata: (error as any).metadata,
    });
    throw error;
  }
};

/**
 * Example 3: Vendor Fit Analysis
 */
export const analyzeVendorFitExample = async (): Promise<void> => {
  const partnerInfo = {
    domain: 'partner-company.com',
    name: 'Partner Company',
    products: ['Product A', 'Product B'],
    services: ['Service X', 'Service Y'],
    targetMarket: 'Enterprise',
  };

  const opportunityContext = `
    Large enterprise opportunity in the healthcare sector.
    Looking for AI-powered solutions to improve patient outcomes.
    Budget: $500K-$1M, Timeline: 6 months.
  `;

  const options: AgentExecutionOptions = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    metadata: {
      dealId: 'deal-789',
      opportunity: 'healthcare-enterprise',
    },
  };

  try {
    const result = await vendorFitAgent.analyzeVendorFit(partnerInfo, opportunityContext, options);

    logger.info('Vendor fit analysis completed', {
      traceId: result.traceId,
      headline: result.finalResponseParsed.headline,
      executionTime: result.metadata?.executionTimeMs,
    });
  } catch (error) {
    logger.error('Vendor fit analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: (error as any).traceId,
    });
    throw error;
  }
};

/**
 * Example 4: Contact Extraction with WebData Integration
 */
export const extractContactsExample = async (): Promise<void> => {
  const domain = 'target-company.com';

  const options: AgentExecutionOptions = {
    tenantId: 'tenant-123',
    metadata: {
      source: 'lead-qualification',
      priority: 'high',
    },
  };

  try {
    const result = await contactExtractionAgent.extractContacts(domain, options);

    logger.info('Contact extraction completed', {
      domain,
      traceId: result.traceId,
      contactCount: result.finalResponseParsed.contacts.length,
      hasPriorityContact: result.finalResponseParsed.priorityContactId !== null,
      webDataIntegration: result.metadata?.agentMetadata?.webDataContactCount,
    });

    // Display extracted contacts
    result.finalResponseParsed.contacts.forEach((contact, index) => {
      console.log(`Contact ${index + 1}:`, {
        name: contact.name,
        title: contact.title,
        email: contact.email,
        isPriority: index === result.finalResponseParsed.priorityContactId,
      });
    });
  } catch (error) {
    logger.error('Contact extraction failed', {
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: (error as any).traceId,
    });
    throw error;
  }
};

/**
 * Example 5: Email Strategy Generation
 */
export const generateEmailStrategyExample = async (): Promise<void> => {
  const tenantId = 'tenant-123';
  const leadId = 'lead-456';
  const contactId = 'contact-789';

  const options: AgentExecutionOptions = {
    tenantId,
    userId: 'user-456',
    metadata: {
      campaignType: 'cold-outreach',
      priority: 'high-value',
    },
  };

  try {
    const result = await contactStrategyAgent.generateEmailContent(
      tenantId,
      leadId,
      contactId,
      options
    );

    logger.info('Email strategy generation completed', {
      tenantId,
      leadId,
      contactId,
      traceId: result.traceId,
      emailCount: result.finalResponseParsed.emails?.length || 0,
      executionTime: result.metadata?.executionTimeMs,
    });

    // Display generated emails
    result.finalResponseParsed.emails?.forEach((email, index) => {
      console.log(`Email ${index + 1} (${email.id}):`, {
        subject: email.subject,
        bodyPreview: email.body.substring(0, 100) + '...',
      });
    });
  } catch (error) {
    logger.error('Email strategy generation failed', {
      tenantId,
      leadId,
      contactId,
      error: error instanceof Error ? error.message : 'Unknown error',
      traceId: (error as any).traceId,
    });
    throw error;
  }
};

/**
 * Example 6: Error Handling and Recovery
 */
export const errorHandlingExample = async (): Promise<void> => {
  try {
    // This will fail if LangFuse is not properly configured
    await siteAnalysisAgent.analyze('invalid-domain.com', {
      tenantId: 'tenant-123',
    });
  } catch (error) {
    // Enhanced error with trace context
    if (error instanceof Error) {
      console.error('Agent execution failed:', {
        message: error.message,
        traceId: (error as any).traceId,
        metadata: (error as any).metadata,
        stack: error.stack,
      });

      // Check if it's a configuration error
      if (error.message.includes('LangFuse service is not available')) {
        console.error('Configuration Error: Please ensure LangFuse is properly configured');
        console.error('Required environment variables:');
        console.error('- LANGFUSE_PUBLIC_KEY');
        console.error('- LANGFUSE_SECRET_KEY');
        console.error('- LANGFUSE_HOST');
        console.error('- LANGFUSE_ENABLED=true');
      }

      // Check if it's a prompt error
      if (error.message.includes('prompt retrieval not yet implemented')) {
        console.error(
          'Prompt Configuration Error: Please configure required prompts in LangFuse dashboard'
        );
        console.error(
          'Required prompts: summarize_site, vendor_fit, extract_contacts, contact_strategy'
        );
      }
    }
  }
};

/**
 * Example 7: Health Monitoring
 */
export const healthMonitoringExample = async (): Promise<void> => {
  try {
    const status = getLangFuseStatus();

    console.log('System Health Status:');
    console.log(`📊 LangFuse: ${status.available ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`   Initialized: ${status.initialized}`);
    if (status.config) {
      console.log(`   Host: ${status.config.host}`);
      console.log(`   Enabled: ${status.config.enabled}`);
    }

    // LangFuse prompt system (no caching)
    console.log('\n📋 Prompt System:');
    console.log('   Type: Direct LangFuse retrieval (no caching)');
    console.log('   Version: Always uses latest production prompts');
  } catch (error) {
    console.error('Health monitoring failed:', error);
  }
};

/**
 * Example 8: Batch Processing with Tracing
 */
export const batchProcessingExample = async (): Promise<void> => {
  const domains = ['company1.com', 'company2.com', 'company3.com'];
  const sessionId = `batch-${Date.now()}`;

  for (const [index, domain] of domains.entries()) {
    const options: AgentExecutionOptions = {
      tenantId: 'tenant-123',
      userId: 'batch-processor',
      sessionId,
      metadata: {
        batchIndex: index.toString(),
        batchSize: domains.length.toString(),
        source: 'batch-processing',
      },
    };

    try {
      const result = await siteAnalysisAgent.analyze(domain, options);

      logger.info(`Batch item ${index + 1}/${domains.length} completed`, {
        domain,
        traceId: result.traceId,
        sessionId,
        executionTime: result.metadata?.executionTimeMs,
      });
    } catch (error) {
      logger.error(`Batch item ${index + 1}/${domains.length} failed`, {
        domain,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        traceId: (error as any).traceId,
      });
      // Continue processing other items
    }
  }

  logger.info(`Batch processing completed for session ${sessionId}`);
};

// Export all examples for easy testing
export const runAllExamples = async (): Promise<void> => {
  try {
    await initializeAISystem();
    await analyzeSiteExample();
    await analyzeVendorFitExample();
    await extractContactsExample();
    await generateEmailStrategyExample();
    await healthMonitoringExample();
    await batchProcessingExample();

    console.log('🎉 All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    await errorHandlingExample();
  }
};
