import os
from dotenv import load_dotenv
from neo4j import GraphDatabase
import threading
import time


load_dotenv()
NEO4J_USERNAME = os.environ.get("NEO4J_USERNAME")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD")
NEO4J_URI = os.environ.get("NEO4J_URI")


def increment_likes(tx):
    query = """
    MATCH (i:Item {id: 1})
    SET i.likes = coalesce(i.likes, 0) + 10000
    RETURN i.likes
    """
    result = tx.run(query)
    return result.single()[0]


def execute_increment():
    with driver.session() as session:
        session.execute_write(increment_likes)


def get_likes():
    with driver.session() as session:
        result = session.run("MATCH (i:Item {id: 1}) RETURN i.likes").single()
        total_likes = result[0] if result else 0
        print(f"Total likes: {total_likes}")
        return total_likes


def start_threads():
    threads = []
    for _ in range(10):
        thread = threading.Thread(target=execute_increment)
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()


if __name__ == "__main__":
    driver = GraphDatabase.driver(
        NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))
    driver.verify_connectivity()

    with driver.session() as session:
        session.run(
            "MERGE (i:Item {id: 1}) SET i.likes = coalesce(i.likes, 0)")

    get_likes()

    start_time = time.time()
    start_threads()
    end_time = time.time()

    get_likes()

    driver.close()

    print(f"Time: {end_time - start_time} seconds")
