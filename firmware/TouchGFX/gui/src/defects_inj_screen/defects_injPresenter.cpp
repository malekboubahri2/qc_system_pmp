#include <gui/defects_inj_screen/defects_injView.hpp>
#include <gui/defects_inj_screen/defects_injPresenter.hpp>
#include <gui/model/Model.hpp>
#include <gui/common/FrontendApplication.hpp>
#include <touchgfx/Application.hpp>

defects_injPresenter::defects_injPresenter(defects_injView& v)
    : view(v)
{
}

void defects_injPresenter::activate()
{
    checkPendingPreciserText();
}

void defects_injPresenter::deactivate()
{
}

void defects_injPresenter::openKeyboardForPreciser()
{
    model->setPreciserOrigin(Model::PreciserOrigin::INJ_DEFECTS);
    model->setPreciserPendingText("");
    static_cast<FrontendApplication*>(touchgfx::Application::getInstance())
        ->gotoinput_typeScreenNoTransition();
}

void defects_injPresenter::checkPendingPreciserText()
{
    if (model->getPreciserOrigin() == Model::PreciserOrigin::INJ_DEFECTS)
    {
        view.receivePreciserText(model->getPreciserPendingText());
        model->clearPreciser();
    }
}

void defects_injPresenter::logDefectInspection(int defectTypeId, const char* note)
{
    /* TODO: enqueue inspection event via Model → mqtt_task (ADR-014).
     * outcome="DEFECT", defect_type_id=defectTypeId, note=note */
    (void)defectTypeId;
    (void)note;
}

void defects_injPresenter::logOkInspection()
{
    /* TODO: enqueue inspection event via Model → mqtt_task (ADR-014).
     * outcome="OK", no defect_type_id */
}
