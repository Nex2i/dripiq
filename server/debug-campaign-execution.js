#!/usr/bin/env node

/**
 * Debug script to investigate campaign execution issues
 * 
 * Usage: node debug-campaign-execution.js [campaignId] [tenantId]
 */

const { campaignPlanExecutionService } = require('./dist/modules/campaign/campaignPlanExecution.service');
const { contactCampaignRepository } = require('./dist/repositories');

async function debugCampaignExecution(campaignId, tenantId) {
  try {
    console.log('=== Campaign Execution Debug ===');
    console.log(`Campaign ID: ${campaignId}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log('');

    // Fetch campaign data
    const campaign = await contactCampaignRepository.findByIdForTenant(campaignId, tenantId);
    if (!campaign) {
      console.error(`❌ Campaign not found: ${campaignId}`);
      return;
    }

    console.log('✅ Campaign found');
    console.log(`Status: ${campaign.status}`);
    console.log(`Current Node ID: ${campaign.currentNodeId}`);
    console.log(`Started At: ${campaign.startedAt}`);
    console.log('');

    if (!campaign.planJson) {
      console.error('❌ Campaign plan not found');
      return;
    }

    const plan = campaign.planJson;
    console.log('✅ Campaign plan found');
    console.log(`Start Node ID: ${plan.startNodeId}`);
    console.log(`Total Nodes: ${plan.nodes.length}`);
    console.log('');

    console.log('=== Campaign Nodes ===');
    plan.nodes.forEach((node, index) => {
      console.log(`${index + 1}. Node ID: ${node.id}`);
      console.log(`   Action: ${node.action}`);
      console.log(`   Channel: ${node.channel || 'N/A'}`);
      console.log(`   Subject: ${node.subject ? node.subject.substring(0, 50) + '...' : 'N/A'}`);
      
      if (node.transitions) {
        console.log(`   Transitions: ${node.transitions.length}`);
        node.transitions.forEach((transition, tIndex) => {
          console.log(`     ${tIndex + 1}. On: ${transition.on} -> To: ${transition.to}`);
          if ('after' in transition) {
            console.log(`        After: ${transition.after}`);
          }
          if ('within' in transition) {
            console.log(`        Within: ${transition.within}`);
          }
        });
      } else {
        console.log(`   Transitions: None`);
      }
      console.log('');
    });

    // Check current node
    if (campaign.currentNodeId) {
      const currentNode = plan.nodes.find(n => n.id === campaign.currentNodeId);
      if (currentNode) {
        console.log('=== Current Node Analysis ===');
        console.log(`Current Node: ${currentNode.id}`);
        console.log(`Action: ${currentNode.action}`);
        console.log(`Channel: ${currentNode.channel || 'N/A'}`);
        
        if (currentNode.transitions) {
          console.log('Available transitions:');
          currentNode.transitions.forEach((transition, index) => {
            console.log(`  ${index + 1}. On: ${transition.on} -> To: ${transition.to}`);
            
            // Find target node
            const targetNode = plan.nodes.find(n => n.id === transition.to);
            if (targetNode) {
              console.log(`     Target Node Action: ${targetNode.action}`);
              console.log(`     Target Node Channel: ${targetNode.channel || 'N/A'}`);
            } else {
              console.log(`     ❌ Target node not found: ${transition.to}`);
            }
          });
        }
      } else {
        console.log(`❌ Current node not found in plan: ${campaign.currentNodeId}`);
      }
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
    console.error(error.stack);
  }
}

// Parse command line arguments
const campaignId = process.argv[2] || 'zj6uquc1d9vnr4iyw0ie1955';
const tenantId = process.argv[3] || 'wdvi348vyx2go53jd0nidgaw';

debugCampaignExecution(campaignId, tenantId)
  .then(() => {
    console.log('=== Debug Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });