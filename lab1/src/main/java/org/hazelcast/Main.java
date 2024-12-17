package org.hazelcast;

import com.hazelcast.config.Config;
import com.hazelcast.core.Hazelcast;
import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.cp.IAtomicLong;

public class Main {
    public static void main(String[] args) {
        System.setProperty("hazelcast.logging.type", "slf4j");

        Config config = new Config();
        config.getCPSubsystemConfig().setCPMemberCount(3);

        HazelcastInstance instance1 = Hazelcast.newHazelcastInstance(config);
        HazelcastInstance instance2 = Hazelcast.newHazelcastInstance(config);
        HazelcastInstance instance3 = Hazelcast.newHazelcastInstance(config);

        HazelcastCounter counter = new HazelcastCounter(instance1);

        counter.runIncrementTest(new IncrementStrategies.WithoutLocks(counter));
        counter.runIncrementTest(new IncrementStrategies.PessimisticLocking(counter));
        counter.runIncrementTest(new IncrementStrategies.OptimisticLocking(counter));

        IAtomicLong atomicLong = instance1.getCPSubsystem().getAtomicLong("atomicCounter");
        counter.runIncrementTest(new IncrementStrategies.IAtomicLongStrategy(atomicLong));

        System.out.println("Final AtomicLong value: " + atomicLong.get());
        System.exit(0);
    }
}
