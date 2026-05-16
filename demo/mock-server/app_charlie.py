# Charlie's submission — intentionally broken for demo purposes:
#   * GET /businesses pagination response omits the "next" field — breaks Rubric 2
#   * GET /businesses/<id> for a missing id returns 200 with {} instead of 404 — breaks Rubric 5

from flask import Flask, request, jsonify, abort

app = Flask(__name__)

businesses = {}
next_id = 1


def _create(name, address):
    global next_id
    biz = {"id": next_id, "name": name, "address": address}
    businesses[next_id] = biz
    next_id += 1
    return biz


def _seed():
    _create("Joe's Coffee", "123 Main St, Corvallis, OR")
    _create("Beaver Burgers", "456 Monroe Ave, Corvallis, OR")
    _create("Pixel Bookstore", "789 Jackson St, Corvallis, OR")
    _create("Riverside Diner", "12 Riverfront Dr, Corvallis, OR")
    _create("Cloud Nine Bakery", "9 Cloud Ln, Corvallis, OR")


@app.route("/businesses", methods=["POST"])
def create_business():
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON"}), 400

    name = data.get("name")
    address = data.get("address")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Field 'name' is required and must be a non-empty string"}), 400
    if not isinstance(address, str) or not address.strip():
        return jsonify({"error": "Field 'address' is required and must be a non-empty string"}), 400

    biz = _create(name, address)
    return jsonify(biz), 201


@app.route("/businesses", methods=["GET"])
def list_businesses():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 3))
    except ValueError:
        return jsonify({"error": "page and limit must be integers"}), 400

    if page < 1 or limit < 1:
        return jsonify({"error": "page and limit must be positive integers"}), 400

    all_items = sorted(businesses.values(), key=lambda b: b["id"])
    total = len(all_items)
    start = (page - 1) * limit
    end = start + limit
    page_items = all_items[start:end]

    # BUG: Charlie forgot the "next" field entirely. Pagination assertions
    # that depend on `next` will fail.
    return jsonify({"businesses": page_items, "total": total}), 200


@app.route("/businesses/<int:biz_id>", methods=["GET"])
def get_business(biz_id):
    biz = businesses.get(biz_id)
    if not biz:
        # BUG: Charlie returns 200 with an empty object instead of 404.
        return jsonify({}), 200
    return jsonify(biz), 200


@app.route("/businesses/<int:biz_id>", methods=["DELETE"])
def delete_business(biz_id):
    if biz_id not in businesses:
        return jsonify({"error": f"Business {biz_id} not found"}), 404
    del businesses[biz_id]
    return "", 204


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Resource not found"}), 404


_seed()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
