import subprocess
from pymongo import MongoClient
import pymongo
from multiprocessing import Process
import time
import os


# Функція для інкрементації лічильника
def increment_likes(write_concern_uri):
    client = MongoClient(write_concern_uri)
    db = client.test

    for _ in range(10000):
        while True:
            try:
                db.likes.find_one_and_update({}, {"$inc": {"counter": 1}})
                break
            except pymongo.errors.AutoReconnect:
                print("Втрачене з'єднання. Повторна спроба...")
                time.sleep(0.5)
            except pymongo.errors.WriteConcernError as e:
                print(f"Помилка WriteConcern: {e}. Повторна спроба...")
                time.sleep(0.5)
    client.close()


# Функція для отримання поточного Primary
def get_primary():
    client = MongoClient("mongodb://localhost:27017")
    rs_status = client.admin.command("replSetGetStatus")
    client.close()

    for member in rs_status["members"]:
        if member["stateStr"] == "PRIMARY":
            return member["name"].split(":")[1]
    return None


# Функція для запуску ноди
def start_node(port, dbpath, logpath):
    while True:
        result = os.system(
            f"mongod --replSet rs0 --port {port} --dbpath {dbpath} "
            f"--bind_ip localhost --fork --logpath {logpath} > /dev/null"
        )
        if result == 0:
            break
        time.sleep(0.3)

    print(f"Нода на порту {port} запущена.")


# Функція для зупинки ноди
def stop_node(port):
    try:
        output = subprocess.check_output(
            f"lsof -i:{port} | grep LISTEN", shell=True
        ).decode("utf-8").strip()
        pid = output.split()[1]
        os.system(f"kill -9 {pid}")
        print(f"Нода на порту {port} зупинена (PID: {pid}).")
    except subprocess.CalledProcessError:
        print(
            f"Не вдалося знайти процес для порту {port}, можливо він уже зупинений.")


# Функція для створення процесів
def create_processes(w="majority"):
    base_uri = "mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0"
    uri_with_wc = f"{base_uri}&w={w}&wtimeoutMS=5000"

    processes = [Process(target=increment_likes, args=(uri_with_wc,))
                 for _ in range(10)]
    for process in processes:
        process.start()

    return processes


# Функція тестування
def run_test(db, write_concern=0, disable_primary=False):
    wc_label = write_concern if write_concern else "majority"
    print(f"Тест з writeConcern={wc_label} "
          f"({'з вимкненням Primary' if disable_primary else 'без вимкнень'})")

    start_time = time.time()
    processes = create_processes(write_concern)

    if disable_primary:
        time.sleep(2)
        primary_port = get_primary()
        print(f"Вимикаємо Primary на порту {primary_port}...")
        stop_node(primary_port)

    for process in processes:
        process.join()

    # Перевірка фінального лічильника
    if not write_concern:
        for _ in range(4):
            if db.likes.find_one()["counter"] == 100_000:
                break
            time.sleep(1)

    print(f"Фінальний лічильник: {db.likes.find_one()['counter']}")
    print(f"Час виконання: {time.time() - start_time} сек.\n")

    if disable_primary:
        input("Очікуємо увімкнення вимкненої ноди...")
        print("Нода увімкнена!\n")

    reset_counter(db)


# Функція ініціалізації бази даних
def initialize_db():
    uri = "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0"
    client = MongoClient(uri)
    db = client.test
    db.likes.drop()
    db.likes.insert_one({"counter": 0})
    print("Колекцію створено. Поточний лічильник: 0")
    return db


# Функція скидання лічильника
def reset_counter(db):
    db.likes.drop()
    db.likes.insert_one({"counter": 0})
    print("Лічильник скинуто!")


# Основний блок
if __name__ == "__main__":
    db = initialize_db()

    # Тестування з різними конфігураціями
    run_test(db, 1, False)
    run_test(db, 0, False)
    run_test(db, 1, True)
    run_test(db, 0, True)
