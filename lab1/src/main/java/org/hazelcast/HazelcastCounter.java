package org.hazelcast;

import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.cp.IAtomicLong;
import com.hazelcast.map.IMap;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

public class HazelcastCounter {
    private final HazelcastInstance hazelcastInstance;
    public final IMap<String, VersionedValue> counterMap;

    public HazelcastCounter(HazelcastInstance hazelcastInstance) {
        this.hazelcastInstance = hazelcastInstance;
        this.counterMap = hazelcastInstance.getMap("counterMap");
    }

    public void resetCounter() {
        counterMap.put("counter", new VersionedValue(0, 0));
        IAtomicLong atomicLong = hazelcastInstance.getCPSubsystem().getAtomicLong("atomicCounter");
        atomicLong.set(0);
    }

    public void runIncrementTest(IncrementStrategy strategy) {
        resetCounter();
        ExecutorService executorService = Executors.newFixedThreadPool(10);
        long startTime = System.currentTimeMillis();

        for (int t = 0; t < 10; t++) {
            executorService.submit(() -> {
                for (int i = 0; i < 10000; i++) {
                    strategy.increment();
                }
            });
        }

        executorService.shutdown();
        try {
            executorService.awaitTermination(10, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        long endTime = System.currentTimeMillis();
        System.out.println(strategy.getName() + " - Time taken: " + (endTime - startTime) + " ms");
    }

    public interface IncrementStrategy {
        void increment();
        String getName();
    }

    public static class VersionedValue {
        public final int value;
        public final int version;

        public VersionedValue(int value, int version) {
            this.value = value;
            this.version = version;
        }
    }
}