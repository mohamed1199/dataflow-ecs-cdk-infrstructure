import * as cdk from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { NetworkLoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { PrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import * as msk from "@aws-cdk/aws-msk-alpha";

export interface MskClusterStackProps extends cdk.StackProps {
  vpc: Vpc;
}

export class MskClusterStack extends cdk.Stack {

  public readonly brokers: string;

  constructor(scope: Construct, id: string, props: MskClusterStackProps) {
    super(scope, id, props);

    const vpc = props.vpc;

    const dataflowSG = cdk.Fn.importValue('dataflowSg');
    const kafkaClientSG = cdk.Fn.importValue('kafkaClientSg');

    const mskSG = new SecurityGroup(this, 'msk-sg', {
      securityGroupName: 'msk-sg',
      vpc: vpc,
      allowAllOutbound: true
    });

    mskSG.addIngressRule(Peer.securityGroupId(dataflowSG), Port.tcp(9393));
    mskSG.addIngressRule(Peer.securityGroupId(kafkaClientSG), Port.tcp(8080));

    const mskCluster = new msk.Cluster(this, 'MskCluster', {
      clusterName: 'MskCluster',
      kafkaVersion: msk.KafkaVersion.V2_8_0,
      numberOfBrokerNodes: 1,
      encryptionInTransit: {
        clientBroker: msk.ClientBrokerEncryption.PLAINTEXT,
      },
      vpc: vpc,
      ebsStorageInfo: {
        volumeSize: 5
      },
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.SMALL),
      securityGroups: [mskSG],
      vpcSubnets: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }),
    });

    this.brokers = mskCluster.bootstrapBrokers;

  }
}