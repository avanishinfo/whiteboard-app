import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── ECR Repository ────────────────────────────────────────────────────────
    const repository = new ecr.Repository(this, 'WhiteboardRepo', {
      repositoryName: 'whiteboard-backend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
      lifecycleRules: [
        {
          // Keep only the 10 most recent images to control storage costs
          maxImageCount: 10,
          description: 'Keep last 10 images',
        },
      ],
    });

    // ── VPC ───────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'WhiteboardVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { cidrMask: 24, name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { cidrMask: 24, name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    // ── ECS Cluster ───────────────────────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'WhiteboardCluster', {
      vpc,
      clusterName: 'whiteboard-cluster',
      containerInsights: true,
    });

    // ── Task Definition ───────────────────────────────────────────────────────
    const taskDef = new ecs.FargateTaskDefinition(this, 'WhiteboardTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      family: 'whiteboard-backend',
    });

    const logGroup = new logs.LogGroup(this, 'WhiteboardLogs', {
      logGroupName: '/ecs/whiteboard-backend',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const container = taskDef.addContainer('whiteboard', {
      // Image is updated by the deploy-backend.sh script via `aws ecs update-service --force-new-deployment`.
      // Using a placeholder tag here; the ECR repo URI is exported below.
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'whiteboard',
        logGroup,
      }),
      environment: {
        PORT: '8080',
        NODE_ENV: 'production',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget -qO- http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        startPeriod: cdk.Duration.seconds(15),
        retries: 3,
      },
    });

    container.addPortMappings({ containerPort: 8080, protocol: ecs.Protocol.TCP });

    // ── Security Groups ───────────────────────────────────────────────────────
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'ALB: allow HTTP/WS from anywhere',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP/WS');

    const serviceSg = new ec2.SecurityGroup(this, 'ServiceSg', {
      vpc,
      description: 'ECS service: allow port 8080 from ALB only',
      allowAllOutbound: true,
    });
    serviceSg.addIngressRule(albSg, ec2.Port.tcp(8080), 'From ALB');

    // ── Application Load Balancer ─────────────────────────────────────────────
    // ALB natively supports WebSocket (HTTP → WS upgrade is transparent).
    const alb = new elbv2.ApplicationLoadBalancer(this, 'WhiteboardAlb', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      loadBalancerName: 'whiteboard-alb',
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // ── Target Group ──────────────────────────────────────────────────────────
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'WhiteboardTg', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        protocol: elbv2.Protocol.HTTP,
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      // Sticky sessions keep long-lived WebSocket connections on the same task.
      // If you scale to multiple tasks and want true multi-instance support,
      // replace in-memory room state with Redis (ElastiCache).
      stickinessCookieDuration: cdk.Duration.days(1),
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ── Fargate Service ───────────────────────────────────────────────────────
    const service = new ecs.FargateService(this, 'WhiteboardService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      securityGroups: [serviceSg],
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      serviceName: 'whiteboard-service',
      circuitBreaker: { rollback: true },
      enableExecuteCommand: true, // allows `aws ecs execute-command` for debugging
    });

    service.attachToApplicationTargetGroup(targetGroup);

    // ── HTTP Listener ─────────────────────────────────────────────────────────
    alb.addListener('HttpListener', {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'Set as VITE_WS_URL=ws://<this-value> in your frontend .env',
      exportName: 'WhiteboardAlbDnsName',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: repository.repositoryUri,
      description: 'ECR repository URI — used by deploy-backend.sh',
      exportName: 'WhiteboardEcrUri',
    });

    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: cluster.clusterName,
      exportName: 'WhiteboardClusterName',
    });

    new cdk.CfnOutput(this, 'EcsServiceName', {
      value: service.serviceName,
      exportName: 'WhiteboardServiceName',
    });
  }
}
